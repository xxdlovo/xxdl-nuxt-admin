import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { BadgeConfig } from '#shared/types/nuxtui'
import { badgeColorClasses } from '../badgeColorClasses'

function isBadgeConfig(config: unknown): config is BadgeConfig {
  if (typeof config !== 'object' || config === null) {
    return false
  }

  const obj = config as Record<string, unknown>
  return typeof obj.i18nKey === 'string' && typeof obj.color === 'string'
}

export function useBadgeColumn<TData = any>(
  accessorKey: string,
  headerI18nKey: string,
  configMap: Readonly<Record<string, BadgeConfig>>,
  defaultValue: number = 0
): TableColumn<TData> {
  const { $ts } = useI18n()

  return {
    accessorKey,
    header: () => $ts(headerI18nKey),
    cell: ({ row }: any) => {
      const value = (row.getValue(accessorKey) as number) ?? defaultValue
      const key = String(value)
      const rawConfig: unknown = configMap[key] ?? configMap[String(defaultValue)]

      if (!isBadgeConfig(rawConfig)) {
        return ''
      }

      const label = $ts(rawConfig.i18nKey)
      const colorClass = badgeColorClasses[rawConfig.color] || badgeColorClasses.neutral

      const children: (ReturnType<typeof h> | string)[] = [label]
      if (rawConfig.icon) {
        children.unshift(h('i', {
          class: rawConfig.icon,
          style: { marginRight: '4px' }
        }))
      }

      return h('div', {
        class: `inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${colorClass}`
      }, children)
    }
  }
}

export function useActionsColumn<T>(
  actions: ActionConfig<T>[],
  headerText?: string
): TableColumn<T> {
  const { $ts } = useI18n()

  return {
    accessorKey: 'actions',
    header: () => headerText || $ts('common.operate'),
    cell: ({ row }: any) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')

      return h('div', { class: 'flex gap-2' },
        actions.map(action => {
          if (action.type === 'edit') {
            return h(UButton, {
              variant: 'outline',
              color: 'primary',
              size: 'xs',
              onClick: () => action.onClick?.(row.original)
            }, { default: () => $ts('common.edit') })
          }

          if (action.type === 'delete') {
            return h(Popconfirm, {
              onConfirm: () => action.onClick?.(row.original)
            }, {
              trigger: () => h(UButton, {
                variant: 'outline',
                color: 'error',
                size: 'xs'
              }, { default: () => $ts('common.delete') })
            })
          }

          if (action.render) {
            return action.render(row.original)
          }

          return null
        })
      )
    }
  }
}

export interface ActionConfig<T> {
  type: 'edit' | 'delete' | 'custom'
  onClick?: (row: T) => void | Promise<void>
  render?: (row: T) => any
}
