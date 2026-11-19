import { fileURLToPath } from 'node:url'

// ============================================================================
// 电商层（可选）配置
//
// 本层在基座之上提供会员、商品、订单、支付、钱包等业务能力，
// 通过 `extends` 声明对基座的依赖，形成单向继承：
//
//     业务项目 → xxdl-admin-trade → xxdl-admin-core
//
// 覆盖关系：业务项目 > 本层 > 基座。因此本层可以覆盖基座的默认页面
// （例如首页看板 `/system/home`），而基座完全不需要知道本层存在。
// ============================================================================

const currentDir = fileURLToPath(new URL('.', import.meta.url))

export default defineNuxtConfig({
    $meta: {
        name: 'admin-trade'
    },
    // 必须用包名，不能用 '../admin-core' 这类相对路径：
    // Nuxt 按本文件所在目录解析相对路径，发布成 npm 包后会变成
    // node_modules/admin-core（实际包名是 xxdl-admin-core），导致宿主 extends 失败。
    // monorepo 内由 pnpm 的 workspace 链接提供，发布后由本包的 dependencies 提供。
    extends: ['xxdl-admin-core'],
    compatibilityDate: '2025-07-15',
    alias: {
        '#trade': currentDir
    },
    nitro: {
        // 服务端打包同样需要 `#trade/*`（Vite 与 Nitro 的别名互不共享）
        alias: {
            '#trade': currentDir
        }
    }
})
