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
    extends: ['../admin-core'],
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
