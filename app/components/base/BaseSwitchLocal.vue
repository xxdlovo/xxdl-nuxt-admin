<script setup lang="ts">
const { $getLocale, $switchLocale, $getLocales } = useI18n()
import type { DropdownMenuItem } from '@nuxt/ui'

const locales = $getLocales()
const localeCookie = useCookie<string>('i18n_locale', {
    sameSite: 'lax',
    path: '/'
})

// Keep server-side error translation in sync with the client locale.
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
