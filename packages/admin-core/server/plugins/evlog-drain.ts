import { resolve } from 'node:path'
import { createFsDrain } from 'evlog/fs'
import type { DrainContext, LogLevel } from 'evlog'
// defineNitroPlugin / useRuntimeConfig 由 Nitro 自动导入（见 .nuxt/types/nitro-imports.d.ts）。
// 这里不写 `import ... from 'nitropack/runtime'`：nitropack 只是 devDependency，
// 生产 .output 里没有这个包，显式 import 会让插件依赖构建工具的包布局。

/**
 * 事件等级由低到高。数值用于「最低写入等级」比较：权重 >= 阈值的才落盘。
 */
const LEVEL_WEIGHT: Record<LogLevel, number> = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
    fatal: 5
}

/**
 * 单个日志文件的大小上限（字节），超过后轮转为 `日期.序号.jsonl`（上限 .999）。
 */
const MAX_SIZE_PER_FILE = 5 * 1024 * 1024

/**
 * 目录内保留的日志文件数量，超出后自动删除最旧的文件。
 * 文件按天切分，单日写满 MAX_SIZE_PER_FILE 会额外占用一个名额，
 * 因此 14 大致相当于「两周左右」，而不是严格的 14 天。
 */
const MAX_FILES = 14

/**
 * 把配置里的等级字符串收敛为合法 LogLevel，非法值回退 info 并提示一次。
 */
function resolveMinLevel(value: unknown): LogLevel {
    if (typeof value === 'string' && value in LEVEL_WEIGHT) {
        return value as LogLevel
    }

    console.warn(`[evlog] 未知的日志写入等级 "${String(value)}"，已回退为 info`)

    return 'info'
}

/**
 * evlog 宽事件落盘（所有环境都会注册）：
 *
 * - 写入 `<evlogFsDir>/YYYY-MM-DD.jsonl`（NDJSON，一行一条），默认目录 `.data/evlogs/app`；
 * - 单文件超过 5MB 轮转为 `YYYY-MM-DD.N.jsonl`，目录内只保留最近 14 个 `.jsonl` 文件；
 * - 低于 `evlogFsLevel` 的事件直接丢弃，不落盘（默认 info，可用 NUXT_EVLOG_FS_LEVEL 覆盖）；
 * - 目录不可写（EROFS/EACCES/EPERM，例如只读文件系统的容器）时，
 *   evlog 只会警告一次并停用本 drain，不会影响业务请求；
 * - 生产部署请把 .data/evlogs 挂成 volume，否则日志随容器销毁。
 *
 * 说明：evlog 的文件 drain 会在日志目录里写一个内容为 `*` 的 .gitignore，
 * 避免日志被误提交；目录本身已在项目 .gitignore（.data）里忽略。
 *
 * 读取历史 / 实时跟随可直接用 `readFsLogs`、`tailFsLogs`（evlog/fs）。
 * 若要批量写入 + 重试 + 缓冲上限，可把下面的 fsDrain 用
 * `createDrainPipeline({ batch: { size: 50, intervalMs: 5000 } })` 包一层。
 */
export default defineNitroPlugin((nitroApp) => {
    const runtimeConfig = useRuntimeConfig() as {
        evlogFsDir?: string
        evlogFsLevel?: string
    }

    const dir = resolve(process.cwd(), runtimeConfig.evlogFsDir ?? '.data/evlogs/app')
    const minLevel = resolveMinLevel(runtimeConfig.evlogFsLevel)
    const minWeight = LEVEL_WEIGHT[minLevel]

    const fsDrain = createFsDrain({
        dir,
        maxFiles: MAX_FILES,
        maxSizePerFile: MAX_SIZE_PER_FILE,
        // 必须保持 NDJSON：pretty 会写成多行 JSON，readFsLogs / tailFsLogs 将无法解析
        pretty: false
    })

    nitroApp.hooks.hook('evlog:drain', (ctx: DrainContext) => {
        const level = ctx?.event?.level

        // 等级缺失（理论上不会出现）按 info 处理，避免误丢事件
        const weight = typeof level === 'string' && level in LEVEL_WEIGHT
            ? LEVEL_WEIGHT[level as LogLevel]
            : LEVEL_WEIGHT.info

        if (weight < minWeight) {
            return
        }

        return fsDrain(ctx)
    })
})
