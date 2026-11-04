/**
 * 顶栏用户菜单的扩展点。
 *
 * 基座的用户菜单只包含账号自身能力（个人中心、退出）。业务层往往还需要
 * 追加自助入口（例如电商层的「钱包」「商城」「我的订单」）。
 *
 * 为什么不直接用同名组件覆盖：
 * Nuxt 对 components 目录做的是「合并 + 同名去重」，两层出现同名组件时
 * 类型解析会退化（表现为模板里所有自动导入与全局属性都报「不存在」）。
 * 因此这里改为运行时注册表：业务层在自己的 app 插件里追加菜单项，
 * 基座组件负责渲染，双方都不需要覆盖对方的文件。
 */

export type UserMenuItem = {
  /** 唯一标识，用于去重与调试 */
  key: string
  /** i18n key（渲染时取文案，保证语言切换后即时生效） */
  labelKey: string
  /** 图标名，例如 `i-lucide-wallet` */
  icon: string
  /** 目标路由 */
  to: string
}

const extraItems = shallowRef<UserMenuItem[]>([])

/** 业务层注册额外的用户菜单项（在 app 插件里调用；重复 key 会被覆盖） */
export function registerUserMenuItems(items: UserMenuItem[]) {
    const merged = new Map(extraItems.value.map(item => [item.key, item]))

    for (const item of items) {
        merged.set(item.key, item)
    }

    extraItems.value = Array.from(merged.values())
}

/** 供顶栏组件读取已注册的额外菜单项 */
export function useUserMenuExtraItems() {
    return extraItems
}
