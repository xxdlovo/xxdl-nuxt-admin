/**
 * usePaginatedTable 分页表格 hook
 * 基于 useTable，添加分页管理、搜索、刷新等功能
 */

import type { Ref } from 'vue'
import { useTable } from './useTable'
import type { PaginatedData, PaginationParams, UsePaginatedTableOptions } from './types'

export interface UsePaginatedTableReturn<T> {
  data: Ref<T[]>
  loading: Ref<boolean>
  error: Ref<Error | null>
  columns: Ref<any[]>
  pagination: { page: number; pageSize: number; total: number }
  pageSizeOptions: number[]
  search: (params?: Record<string, any>) => Promise<void>
  refresh: () => Promise<void>
  getDataByPage: (page?: number,params?: Record<string, any>) => Promise<void>
  reloadColumns: () => void
}

export function usePaginatedTable<T>(options: UsePaginatedTableOptions<T>): UsePaginatedTableReturn<T> {
  // 分页信息
  const pagination = reactive({
    page: options.initialPage ?? 1,
    pageSize: options.initialPageSize ?? 20,
    total: 0
  })

  // 每页条数选项
  const pageSizeOptions = options.pageSizeOptions ?? [10, 20, 50, 100]

  // 基础 table hook
  const table = useTable<T>({
    ...options,
    onFetched: (data: PaginatedData<T>) => {
      pagination.page = data.page
      pagination.pageSize = data.pageSize
      pagination.total = data.total
      options.onFetched?.(data)
    }
  })

  /**
   * 搜索/查询方法
   * @param params - 额外的查询参数（会与分页参数合并）
   */
  const search = async (params?: Record<string, any>): Promise<void> => {
    const paginationParams: PaginationParams = {
      page: pagination.page,
      pageSize: pagination.pageSize
    }

    await table.getData({
      ...paginationParams,
      ...params
    })
  }

  /**
   * 刷新数据（保持当前页和搜索条件）
   */
  const refresh = async (): Promise<void> => {
    await search()
  }

  // 当前搜索参数缓存
  const currentSearchParams = ref<Record<string, any>>({})

  /**
   * 按页码获取数据
   * 如果页码与当前页不同，先切换页码，然后通过 watch 自动触发搜索
   * @param page - 目标页码，默认为 1
   * @param searchParams - 搜索参数
   */
  const getDataByPage = async (page: number = 1, searchParams?: Record<string, any>): Promise<void> => {
    // 更新搜索参数缓存
    if (searchParams) {
      currentSearchParams.value = searchParams
    }

    if (page !== pagination.page) {
      pagination.page = page
      return
    }
    await search(currentSearchParams.value)
  }

  // 监听分页参数变化，自动获取数据
  watch(
    () => ({ page: pagination.page, pageSize: pagination.pageSize }),
    async (newVal, oldVal) => {
      // 只有真正变化时才触发搜索
      if (oldVal && (newVal.page !== oldVal.page || newVal.pageSize !== oldVal.pageSize)) {
        await search()
      }
    },
    { immediate: false }
  )

  return {
    ...table,
    pagination,
    pageSizeOptions,
    search,
    refresh,
    getDataByPage
  }
}
