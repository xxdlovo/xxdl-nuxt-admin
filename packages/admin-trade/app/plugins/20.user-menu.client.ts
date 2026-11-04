import { registerUserMenuItems } from '#admin/app/composables/useUserMenu'

/**
 * 把电商域的自助入口挂到基座的顶栏用户菜单上。
 *
 * 基座组件不认识这些路由，由本插件在启动时注册：
 * 钱包与余额流水、商城下单、我的订单。
 */
export default defineNuxtPlugin(() => {
    registerUserMenuItems([
        {
            key: 'wallet',
            labelKey: 'module.system.wallet.title',
            icon: 'i-lucide-wallet',
            to: '/system/wallet'
        },
        {
            key: 'mall',
            labelKey: 'module.system.mall.title',
            icon: 'i-lucide-store',
            to: '/system/mall'
        },
        {
            key: 'my-orders',
            labelKey: 'module.system.myOrder.title',
            icon: 'i-lucide-receipt',
            to: '/system/my-orders'
        }
    ])
})
