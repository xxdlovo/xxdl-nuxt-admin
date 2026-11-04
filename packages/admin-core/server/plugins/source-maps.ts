/**
 * 启用 Node 原生的 source map 支持，让错误堆栈直接指向 TS 源码。
 *
 * 为什么需要它：
 * - dev 下 Nitro 把服务端代码打包进 `.nuxt/dev/index.mjs`，生产下打进
 *   `.output/server/chunks/**`，V8 默认给出的堆栈是这些打包产物路径
 *   （`.nuxt/dev/index.mjs:8461`、`.output/server/chunks/_/xxx.mjs:120`），
 *   既定位不到业务文件，evlog 也会把这类帧当成「非应用帧」隐藏掉。
 * - Node 默认不读取 `//# sourceMappingURL`；显式开启后，堆栈会还原成
 *   `server/demo-router/DemoService.ts:48`。
 *
 * 两种产物都自带 .map（`.nuxt/dev/index.mjs.map`、
 * `.output/server/chunks/**_/xxx.mjs.map`，sources 指向 `server/` 目录下的 `.ts` 源文件），
 * 因此 dev 与生产都能还原。运行时 API 等价于启动参数 `--enable-source-maps`，
 * 好处是不必改 dev / 生产的启动命令与 Docker CMD。
 *
 * 为什么这里不写 import：
 * `defineNitroPlugin` 由 Nitro 自动导入（见 `.nuxt/types/nitro-imports.d.ts`）。
 * nitropack 只是本项目的 devDependency，生产 `.output` 里没有这个包，
 * 显式 `import ... from 'nitropack/runtime'` 会把插件和构建工具的包布局绑在一起；
 * 自动导入由 Nitro 在构建期解析，与运行环境的依赖布局无关。
 *
 * 代价：错误对象创建时会多一次 source map 查找（Node 会缓存已加载的 map），
 * 只影响错误路径；如果确实要关掉，删掉本插件即可——此时 AppError 会在构造时用
 * 产物同目录的 `.map` 同步兜底一次（见 server/utils/appError.ts）。
 */
export default defineNitroPlugin(() => {
    // 只做能力探测，任何一项缺失都安静跳过：
    // - Edge / 非 Node 运行时没有 process；
    // - Node < 16.6 没有 setSourceMapsEnabled。
    if (typeof process === 'undefined' || typeof process.setSourceMapsEnabled !== 'function') {
        return
    }

    try {
        process.setSourceMapsEnabled(true)
    }
    catch (error) {
        // 开启失败不阻断启动，只是堆栈保留打包产物路径
        console.warn('[source-maps] 启用 source map 失败，错误堆栈将保留打包产物路径：', error)
    }
})
