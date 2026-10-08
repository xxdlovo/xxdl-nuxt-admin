import { readFileSync } from 'node:fs'
import { SourceMap } from 'node:module'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
// 同目录相对导入：appError.ts 也会被 tests/** 与脚本直接引用（不走 Nuxt 构建），
// 因此这里不能使用 '#server/**' 别名。
import { resolveCurrentRequestId } from './requestId'

/**
 * 业务错误类
 * 抛出 i18n key，由 errorFormatter 自动翻译后返回给客户端
 *
 * @example
 * throw new AppError('user.notFound')
 * // 客户端收到翻译后的消息: "用户不存在"
 *
 * @example
 * throw new AppError('form.userName.required')
 * // 客户端收到翻译后的消息: "请输入用户名"
 */
export class AppError extends Error {
  /**
   * 抛出位置，形如相对项目根目录的 `server/demo-router/DemoService.ts:50`。
   *
   * 构造时自动处理，业务代码不需要额外调用：
   * 1. `server/plugins/source-maps.ts` 开启的 Node source map 支持会让堆栈直接
   *    指向源码，此时取堆栈里第一个业务帧；
   * 2. 堆栈仍指向打包产物（`.nuxt/dev/index.mjs`、`.output/server/chunks/**`）时，
   *    构造函数用同目录的 `.map` 同步还原一次再取。
   *
   * 两者都不可用（例如部署时裁剪了 `.map`）时为 `undefined`，堆栈保持原样。
   */
  readonly location?: string

  /**
   * 当前请求的 evlog requestId（宽事件里的 `requestId` 字段）。
   *
   * 系统操作日志的 `traceId` 与 `.data/evlogs` 运行日志的 `requestId` 使用同一个值，
   * 因此可以用它在两类日志里互相定位同一次请求。
   * 非请求上下文（定时任务、脚本）为 `undefined`。
   */
  readonly requestId?: string

  /**
   * @param i18nKey - 国际化 key，如 'form.userName.required'
   * @param options  - 可选参数，如自定义 message 或 cause
   */
  constructor(
    public readonly i18nKey: string,
    options?: { message?: string; cause?: unknown }
  ) {
    super(options?.message ?? i18nKey, { cause: options?.cause })
    this.name = 'AppError'

    // 先把打包产物堆栈还原为源码位置，再据此提取抛出位置
    remapBundledStack(this)
    this.location = findAppLocation(this.stack)
    this.requestId = resolveCurrentRequestId()
  }
}

/** 依赖目录：这些帧不参与还原，也不作为抛出位置。 */
const DEPENDENCY_PATH_RE = /(?:^|[/\\])node_modules(?:[/\\]|$)/

/** 打包产物目录：堆栈里出现这些路径说明 source map 没有生效。 */
const BUNDLED_PATH_RE = /(?:^|[/\\])(?:node_modules|\.nuxt|\.output)(?:[/\\]|$)/

/** 只有 JS 产物可能带同级 `.map`；`.ts` / `.vue` 帧直接跳过，省掉多余的磁盘探测。 */
const MAPPABLE_EXT_RE = /\.[cm]?js$/

/**
 * V8 堆栈帧解析，兼容以下写法：
 * - `at fn (D:\a\b.mjs:1:2)`
 * - `at async fn (file:///D:/a/b.ts:1:2)`
 * - `at D:\a\b.mjs:1:2`
 */
const FRAME_RE = /^\s*at\s+(?:(?<fn>[^(]+?)\s+\()?(?<loc>[^()]+?):(?<line>\d+):(?<col>\d+)\)?\s*$/

/**
 * 已解析的 source map 缓存。`null` 表示该产物没有 `.map` 或无法解析，
 * 缓存后避免每次构造 AppError 都重复探测同一个文件。
 */
const sourceMapCache = new Map<string, SourceMap | null>()

/** `file://` URL → 文件路径；普通路径原样返回。 */
function toFilePath(value: string | undefined) {
  if (!value) {
    return undefined
  }

  if (!value.startsWith('file://')) {
    return value
  }

  try {
    return fileURLToPath(value)
  }
  catch {
    return undefined
  }
}

/** 展示用路径：相对项目根目录，统一正斜杠。 */
function formatStackPath(file: string) {
  const normalized = file.replace(/\\/g, '/')
  const cwd = process.cwd().replace(/\\/g, '/').replace(/\/$/, '')

  if (cwd && normalized.startsWith(`${cwd}/`)) {
    return normalized.slice(cwd.length + 1)
  }

  return normalized
}

function loadSourceMap(file: string) {
  const cached = sourceMapCache.get(file)

  if (cached !== undefined) {
    return cached
  }

  let consumer: SourceMap | null = null

  try {
    consumer = new SourceMap(JSON.parse(readFileSync(`${file}.map`, 'utf8')))
  }
  catch {
    // 产物没有 .map，或 map 已损坏：保持原堆栈，不影响业务流程
    consumer = null
  }

  sourceMapCache.set(file, consumer)

  return consumer
}

/**
 * `node:module` 的 `SourceMap.findEntry` 返回值。
 *
 * @types/node 把返回类型声明成 `{} | SourceMapping` 联合，直接取 `originalSource`
 * 之类的字段会报 TS2339；这里按运行时实际字段结构单独声明，取值时再逐项判空。
 */
type SourceMapEntryLookup = {
  originalSource?: string
  originalLine?: number
  originalColumn?: number
}

/**
 * 把单个打包产物帧还原为源码位置。
 * 依赖目录与 `.ts` / `.vue` 等源码帧返回 `undefined`，由调用方保留原帧。
 */
function mapFrameToSource(rawFile: string, line: number, column: number) {
  const file = toFilePath(rawFile)

  if (!file || DEPENDENCY_PATH_RE.test(file) || !MAPPABLE_EXT_RE.test(file)) {
    return undefined
  }

  const consumer = loadSourceMap(file)

  if (!consumer) {
    return undefined
  }

  // findEntry 的入参与返回值都是 0-based，与栈里的 1-based 行列差 1
  const entry = consumer.findEntry(line - 1, Math.max(0, column - 1)) as SourceMapEntryLookup | undefined
  const source = entry?.originalSource

  if (!entry || !source || entry.originalLine === undefined) {
    return undefined
  }

  const sourcePath = toFilePath(source) ?? source
  const resolved = isAbsolute(sourcePath) ? sourcePath : resolve(dirname(file), sourcePath)

  return {
    file: formatStackPath(resolved),
    line: entry.originalLine + 1,
    column: (entry.originalColumn ?? 0) + 1
  }
}

/** 逐帧重写 `error.stack`；没有任何帧被还原时保持原值。 */
function remapBundledStack(error: Error) {
  const stack = error.stack

  if (!stack) {
    return
  }

  let changed = false

  const lines = stack.split('\n').map((text, index) => {
    // 首行是 `AppError: message`，不是帧
    if (index === 0) {
      return text
    }

    const groups = FRAME_RE.exec(text)?.groups
    const mapped = groups?.loc
      ? mapFrameToSource(groups.loc, Number(groups.line), Number(groups.col))
      : undefined

    if (!mapped) {
      return text
    }

    changed = true

    const fn = groups?.fn?.trim()

    return fn
      ? `    at ${fn} (${mapped.file}:${mapped.line}:${mapped.column})`
      : `    at ${mapped.file}:${mapped.line}:${mapped.column}`
  })

  if (changed) {
    Object.defineProperty(error, 'stack', {
      value: lines.join('\n'),
      writable: true,
      configurable: true
    })
  }
}

/** 取堆栈里第一个业务帧作为抛出位置。 */
function findAppLocation(stack: string | undefined) {
  if (!stack) {
    return undefined
  }

  for (const text of stack.split('\n')) {
    const groups = FRAME_RE.exec(text)?.groups
    const file = toFilePath(groups?.loc)

    if (!file || file.startsWith('node:') || BUNDLED_PATH_RE.test(file)) {
      continue
    }

    return `${formatStackPath(file)}:${groups?.line}`
  }

  return undefined
}

/**
 * AppError → HTTP 状态与 tRPC 错误码的统一映射。
 *
 * 业务错误必须映射到 4xx：前端可据此按 code 分支，
 * 监控与网关也能把「请求有问题」和「服务端异常」分开统计，
 * 而不是把所有业务失败都算成 5xx。
 *
 * 这份映射同时被两处使用，避免规则漂移：
 * - tRPC：server/trpc/errorFormatter.ts
 * - 原生路由：server/api/**（手工映射，见 doc/main/3.backend-handbook/7.api-routes.md）
 */
export const APP_ERROR_STATUS_MAP: Record<string, { code: string; httpStatus: number }> = {
  // 未登录：前端据此跳转登录页
  'auth.unauthorized': { code: 'UNAUTHORIZED', httpStatus: 401 },
  // 已登录但缺少权限码
  'auth.forbidden': { code: 'FORBIDDEN', httpStatus: 403 },
  // demo 模式下的写操作保护，语义上是「禁止」，用 403 而不是 500
  'system.demoReadonly': { code: 'FORBIDDEN', httpStatus: 403 },
  // 查询目标不存在：例如 getOne/getById 未命中
  'common.notExist': { code: 'NOT_FOUND', httpStatus: 404 }
}

/** 未在映射表中登记的业务错误一律按「请求有误」处理。 */
export const DEFAULT_APP_ERROR_STATUS = { code: 'BAD_REQUEST', httpStatus: 400 }

export function resolveAppErrorStatus(i18nKey: string) {
  return APP_ERROR_STATUS_MAP[i18nKey] ?? DEFAULT_APP_ERROR_STATUS
}
