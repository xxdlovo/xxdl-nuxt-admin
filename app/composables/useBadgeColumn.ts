// composables/useBadgeColumn.ts
// TODO 直接用h(UBadge)无效果
import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { BadgeConfig } from '#shared/types/nuxtui'

function isBadgeConfig(config: unknown): config is BadgeConfig {
    return (
        typeof config === 'object' &&
        config !== null &&
        'i18nKey' in config &&
        'color' in config
    )
}

// Nuxt UI 颜色映射
const colorClasses: Record<string, string> = {
    neutral: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
    primary: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
    error: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
    info: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800',
    success: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
}

export function useBadgeColumn<TData = any>(
    accessorKey: string,
    headerI18nKey: string,
    configMap: Record<string, BadgeConfig>,
    defaultValue: number = 0
): TableColumn<TData> {
    const { $ts } = useI18n()

    return {
        accessorKey,
        header: () => $ts(headerI18nKey),
        cell: ({ row }: any) => {
            const value = (row.getValue(accessorKey) as number) ?? defaultValue
            const rawConfig = configMap[String(value)] ?? configMap[String(defaultValue)]

            if (!isBadgeConfig(rawConfig)) {
                return ''
            }

            const label = $ts(rawConfig.i18nKey)
            const colorClass = colorClasses[rawConfig.color] || colorClasses.neutral

            return h('div', {
                class: `inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${colorClass}`
            }, [
                rawConfig.icon && h('i', {
                    class: rawConfig.icon,
                    style: { marginRight: '4px' }
                }),
                label
            ])
        }
    }
}
