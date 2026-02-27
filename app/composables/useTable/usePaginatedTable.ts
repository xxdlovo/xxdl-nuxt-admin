/**
 * usePaginatedTable 分页表格 hook
 * 基于 useTable，添加分页管理、搜索、刷新等功能
 */

import type { Ref } from 'vue'
import { useTable } from './useTable'
import type { PaginatedData, PaginationParams, UsePaginatedTableOptions } from './types'

export function usePaginatedTable<T>(options: UsePaginatedTableOptions<T>) {
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

  /**
   * 切换页码
   * @param page - 目标页码
   */
  const changePage = async (page: number): Promise<void> => {
    pagination.page = page
    await search()
  }

  /**
   * 切换每页条数
   * @param pageSize - 新的每页条数
   */
  const changePageSize = async (pageSize: number): Promise<void> => {
    pagination.pageSize = pageSize
    pagination.page = 1 // 重置到第一页
    await search()
  }

  return {
    ...table,
    pagination,
    pageSizeOptions,
    search,
    refresh,
    changePage,
    changePageSize
  }
}
