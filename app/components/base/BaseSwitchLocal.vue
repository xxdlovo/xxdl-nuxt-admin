<script setup lang="ts">
const { $getLocale, $switchLocale, $getLocales } = useI18n()
import type { DropdownMenuItem } from '@nuxt/ui'

const locales = $getLocales()
const items = computed<DropdownMenuItem[]>(() =>
    locales.map((item) => ({
        label: item.name as string,
        color: item.code === $getLocale() ? 'primary' : 'neutral',
        onClick: () => {
            $switchLocale(item.code)
        }
    }))
)
</script>

<template>

    <UDropdownMenu :items="items">
        <UTooltip :delay-duration="0" :text="$t('icon.lang') as string">
            <UButton icon="i-lucide:languages" color="neutral" variant="ghost" />
        </UTooltip>
    </UDropdownMenu>


</template>
