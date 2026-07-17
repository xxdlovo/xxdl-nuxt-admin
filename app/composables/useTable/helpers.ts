/**
 * useTable 辅助函数
 * 提供常用的列配置工厂函数
 */

import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { BadgeConfig } from '#shared/types/nuxtui'

/**
 * 类型守卫：检查是否为 BadgeConfig
 */
function isBadgeConfig(config: unknown): config is BadgeConfig {
  if (typeof config !== 'object' || config === null) {
    return false
  }
  const obj = config as Record<string, unknown>
  return (
    typeof obj.i18nKey === 'string' &&
    typeof obj.color === 'string'
  )
}

/**
 * Nuxt UI 颜色映射
 */
const colorClasses: Record<string, string> = {
  neutral: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
  primary: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  secondary: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
  error: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  info: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800',
  success: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
}

/**
 * 创建 Badge 列配置
 *
 * @example
 * ```ts
 * useBadgeColumn(
 *   'gender',
 *   'module.system.user.userGender',
 *   USER_GENDER_CONFIG,
 *   0
 * )
 * configMap: 定义值相关的颜色
 * ```
 */
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
      const key = String(value)
      const rawConfig: unknown = configMap[key] ?? configMap[String(defaultValue)]

      if (!isBadgeConfig(rawConfig)) {
        return ''
      }

      const label = $ts(rawConfig.i18nKey)
      const colorClass = colorClasses[rawConfig.color] || colorClasses.neutral

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

/**
 * 操作列配置工厂函数
 * 用于生成包含编辑、删除等操作按钮的列
 *
 * @example
 * ```ts
 * useActionsColumn([
 *   {
 *     type: 'edit',
 *     onClick: (row) => handleEdit(row.id)
 *   },
 *   {
 *     type: 'delete',
 *     onClick: (row) => handleDelete(row.id)
 *   }
 * ])
 * ```
 */
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

          // 自定义渲染
          if (action.render) {
            return action.render(row.original)
          }

          return null
        })
      )
    }
  }
}

/**
 * 操作配置
 */
export interface ActionConfig<T> {
  type: 'edit' | 'delete' | 'custom'
  onClick?: (row: T) => void | Promise<void>
  render?: (row: T) => any
}
