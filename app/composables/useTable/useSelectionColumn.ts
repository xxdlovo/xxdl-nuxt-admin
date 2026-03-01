/**
 * useSelectionColumn 选择列 hook
 * 提供表格的多选列配置
 */

import type { TableColumn } from '@nuxt/ui'
import type { Component } from 'vue'
import { h } from 'vue'

export interface UseSelectionColumnOptions<T extends { id?: string | null }> {
  /** 表格数据 */
  data: Ref<T[]>
  /** 选中的行 keys */
  checkedRowKeys: Ref<string[]>
  /** 复选框组件 */
  checkboxComponent: Component
}

export interface UseSelectionColumnReturn<T> {
  /** 选择列配置 */
  selectionColumn: TableColumn<T>
}

/**
 * 创建选择列
 *
 * @example
 * ```ts
 * const UCheckbox = resolveComponent('UCheckbox')
 * 
 * const { selectionColumn } = useSelectionColumn<SysUserDto>({
 *   data,
 *   checkedRowKeys,
 *   checkboxComponent: UCheckbox
 * })
 *
 * const columns = computed(() => [
 *   selectionColumn,
 *   // ... 其他列
 * ])
 * ```
 */
export function useSelectionColumn<T extends { id?: string | null }>(
  options: UseSelectionColumnOptions<T>
): UseSelectionColumnReturn<T> {
  const { data, checkedRowKeys, checkboxComponent } = options
  const { $ts } = useI18n()

  const selectionColumn: TableColumn<T> = {
    id: 'select',
    enableHiding: false,
    header: () => {
      const allSelected = data.value.length > 0 && checkedRowKeys.value.length === data.value.length
      const someSelected = checkedRowKeys.value.length > 0 && checkedRowKeys.value.length < data.value.length

      return h('div', { class: 'flex items-center justify-center' },
        h(checkboxComponent, {
          modelValue: allSelected,
          indeterminate: someSelected,
          'onUpdate:modelValue': (value: boolean) => {
            if (value) {
              checkedRowKeys.value = data.value.map(item => item.id as string)
            } else {
              checkedRowKeys.value = []
            }
          },
          'aria-label': $ts('common.selectAll')
        })
      )
    },
    cell: ({ row }) => {
      const isSelected = checkedRowKeys.value.includes(row.original.id as string)

      return h('div', { class: 'flex items-center justify-center' },
        h(checkboxComponent, {
          modelValue: isSelected,
          'onUpdate:modelValue': (value: boolean) => {
            if (value) {
              if (!checkedRowKeys.value.includes(row.original.id as string)) {
                checkedRowKeys.value = [...checkedRowKeys.value, row.original.id as string]
              }
            } else {
              checkedRowKeys.value = checkedRowKeys.value.filter(id => id !== row.original.id)
            }
          },
          'aria-label': $ts('common.selectRow')
        })
      )
    }
  }

  return {
    selectionColumn
  }
}
