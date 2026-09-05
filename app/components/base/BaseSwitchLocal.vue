<script setup lang="ts">
const { $getLocale, $switchLocale, $getLocales } = useI18n()
import type { DropdownMenuItem } from '@nuxt/ui'

const locales = $getLocales()
const localeCookie = useCookie<string>('i18n_locale', {
    sameSite: 'lax',
    path: '/',
    // 语言偏好应跨浏览器重启保留一年；同时与 i18n 模块的 Cookie 配置保持一致。
    maxAge: 60 * 60 * 24 * 365
})

// 首次渲染时如果 Cookie 尚不存在，使用 i18n 模块已经解析出的当前语言初始化它。
// 后续切换由下面的 onSelect 同步写入 Cookie，服务端错误翻译也会读取同一个值。
localeCookie.value ||= $getLocale()
const activeLocale = computed(() => localeCookie.value || $getLocale())

const items = computed<DropdownMenuItem[]>(() =>
    locales.map((item) => ({
        label: item.name as string,
        icon: item.code === activeLocale.value ? 'i-lucide-check' : undefined,
        color: item.code === activeLocale.value ? 'primary' : 'neutral',
        onSelect: () => {
            localeCookie.value = item.code
            $switchLocale(item.code)
        }
    }))
)
</script>

<template>
    <UDropdownMenu :items="items">
        <UButton icon="i-lucide-languages" color="neutral" variant="ghost" :aria-label="$t('icon.lang') as string" />
    </UDropdownMenu>
</template>
