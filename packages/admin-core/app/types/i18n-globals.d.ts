export {}

/**
 * 补充 i18n 全局属性的类型声明。
 *
 * `nuxt-i18n-micro` 只把 `$t` / `$ts` 注入到 `NuxtApp`（见生成的
 * `.nuxt/types/i18n-plugin.d.ts`），没有声明到 Vue 的
 * `ComponentCustomProperties`。在单层项目里 Nuxt 的模板类型推断能兜住；
 * 一旦基座同时被多个 Layer 组合（core + trade），模板里直接用 `$ts(...)`
 * 就会报 `Property '$ts' does not exist`。
 *
 * 这里显式合并进 `ComponentCustomProperties`，让模板与 setup 都能拿到类型。
 * 函数签名与 nuxt-i18n-micro 的 `$ts` 保持一致。
 */
declare module 'vue' {
    interface ComponentCustomProperties {
        $t: (key: string, params?: Record<string, unknown>) => string
        $ts: (key: string, params?: Record<string, unknown>) => string
    }
}

declare module '@vue/runtime-core' {
    interface ComponentCustomProperties {
        $t: (key: string, params?: Record<string, unknown>) => string
        $ts: (key: string, params?: Record<string, unknown>) => string
    }
}
