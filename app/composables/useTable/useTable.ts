/**
 * useTable 基础 hook
 * 提供表格数据查询、loading 状态、列配置管理
 */

import type { Ref } from 'vue'
import type { PaginatedData, TableColumn, UseTableOptions } from './types'

export function useTable<T>(options: UseTableOptions<T>) {
  const data = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const error = ref<Error | null>(null)

  // 列配置（使用函数支持国际化动态更新）
  const hasColumns = options.columns && typeof options.columns === 'function'
  const columns = ref<TableColumn<T>[]>(hasColumns ? options.columns() : [])

  /**
   * 重新加载列配置（用于语言切换时更新）
   */
  const reloadColumns = () => {
    if (hasColumns) {
      columns.value = options.columns()
    }
  }

  /**
   * 获取数据
   */
  const getData = async (params?: Record<string, any>): Promise<PaginatedData<T>> => {
    loading.value = true
    error.value = null

    try {
      const paginationParams = {
        page: 1,
        pageSize: 20,
        ...params
      }

      const result = await options.query({
        ...paginationParams,
        ...params
      })

      data.value = result.list
      options.onFetched?.(result)

      return result
    } catch (err) {
      error.value = err as Error
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 监听国际化变化，重新加载列配置
   */
  const { $i18n } = useNuxtApp()
  watch(() => $i18n.locale, reloadColumns)

  return {
    data,
    loading,
    error,
    columns,
    reloadColumns,
    getData
  }
}
