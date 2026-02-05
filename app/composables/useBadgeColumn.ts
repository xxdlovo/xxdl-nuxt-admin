// composables/useBadgeColumn.ts
// TODO 直接用h(UBadge)无效果
import { h } from 'vue'
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
    neutral: 'bg-gray-100 text-gray-800 border-gray-200',
    primary: 'bg-blue-100 text-blue-800 border-blue-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-sky-100 text-sky-800 border-sky-200',
    success: 'bg-green-100 text-green-800 border-green-200',
}

export function useBadgeColumn<T extends Record<string, BadgeConfig> = any>(
    accessorKey: string,
    headerI18nKey: string,
    configMap: T,
    defaultValue: number = 0
) {
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
