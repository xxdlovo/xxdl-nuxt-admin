/**
 * useTable hooks 类型定义
 * 基于 Nuxt UI + tRPC 的表格封装
 */

import type { TableColumn } from '@nuxt/ui'
import type { ApiReq, TrpcPageResp } from '#shared/types/common'

export type { TableColumn }

/**
 * 分页参数（复用 shared 类型）
 */
export type PaginationParams = ApiReq

/**
 * 分页响应数据（复用 shared 类型）
 * tRPC 返回格式：{ list, total, page, pageSize }
 */
export type PaginatedData<T> = TrpcPageResp<T>

/**
 * 表格操作类型
 */
export type OperateType = 'add' | 'edit'

/**
 * 列配置检查（用于列显示/隐藏管理）
 * TODO: 后续实现列配置持久化
 */
export interface ColumnCheck {
  key: string
  title: string
  checked: boolean
  visible: boolean
}

/**
 * useTable 基础配置项
 */
export interface UseTableOptions<T> {
  /**
   * 查询函数 (使用 tRPC)
   */
  query: (params: PaginationParams & Record<string, any>) => Promise<PaginatedData<T>>

  /**
   * 列配置函数（使用函数支持国际化动态更新）
   * 可选参数，如果未提供则返回空数组
   */
  columns?: () => TableColumn<T>[]

  /**
   * 数据获取完成后的回调
   */
  onFetched?: (data: PaginatedData<T>) => void
}

/**
 * usePaginatedTable 配置项
 */
export interface UsePaginatedTableOptions<T> extends UseTableOptions<T> {
  /**
   * 初始页码
   * @default 1
   */
  initialPage?: number

  /**
   * 初始每页条数
   * @default 20
   */
  initialPageSize?: number

  /**
   * 每页条数选项
   * @default [10, 20, 50, 100]
   */
  pageSizeOptions?: number[]
}

/**
 * useTableOperate 配置项
 */
export interface UseTableOperateOptions<T> {
  /**
   * 表格数据
   */
  data: Ref<T[]>

  /**
   * 数据的唯一标识字段名
   */
  idKey: keyof T

  /**
   * 刷新数据的函数
   */
  refresh: () => void | Promise<void>
}

/**
 * 表格操作返回值
 */
export interface TableOperateReturn<T> {
  /**
   * 操作类型
   */
  operateType: Ref<OperateType>

  /**
   * 正在编辑的数据
   */
  editingData: Ref<T | null>

  /**
   * 处理新增
   */
  handleAdd: () => { operateType: OperateType; editingData: null }

  /**
   * 处理编辑
   */
  handleEdit: (id: T[keyof T]) => { operateType: OperateType; editingData: T | null }

  /**
   * 处理删除
   */
  handleDelete: (id: T[keyof T], deleteApi: (id: string) => Promise<void>) => Promise<void>

  /**
   * 处理批量删除
   */
  handleBatchDelete: (ids: T[keyof T][], deleteApi: (ids: string[]) => Promise<void>) => Promise<void>
}

/**
 * usePaginatedTable 返回值
 */
export interface PaginatedTableReturn<T> {
  /**
   * 表格数据
   */
  data: Ref<T[]>

  /**
   * 加载状态
   */
  loading: Ref<boolean>

  /**
   * 错误信息
   */
  error: Ref<Error | null>

  /**
   * 列配置
   */
  columns: Ref<TableColumn<T>[]>

  /**
   * 分页信息
   */
  pagination: {
    page: number
    pageSize: number
    total: number
  }

  /**
   * 搜索/查询
   */
  search: (params?: Record<string, any>) => Promise<void>

  /**
   * 刷新数据
   */
  refresh: () => Promise<void>

  /**
   * 切换页码
   */
  changePage: (page: number) => Promise<void>

  /**
   * 切换每页条数
   */
  changePageSize: (pageSize: number) => Promise<void>

  /**
   * 重新加载列（国际化切换时使用）
   */
  reloadColumns: () => void
}
