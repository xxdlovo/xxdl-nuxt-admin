/**
 * useTable hooks 统一导出
 */

// 从 shared/types/common 导出的类型
export type { ApiReq, TrpcPageResp } from '#admin/shared/types/common'

// useTable 特有的类型
export type {
  PaginationParams,
  PaginatedData,
  OperateType,
  ColumnCheck,
  UseTableOptions,
  UsePaginatedTableOptions,
  UseTableOperateOptions,
  TableOperateReturn,
  PaginatedTableReturn
} from './types'

// hooks 导出
export { useTable } from './useTable'
export { usePaginatedTable } from './usePaginatedTable'
export { useTableOperate } from './useTableOperate'
export { useSelectionColumn } from './useSelectionColumn'

// 辅助函数导出
export {
  useBadgeColumn,
  useActionsColumn,
  type ActionConfig
} from './helpers'

// 列宽工具导出
export {
  tableColumnWidth,
  stableColumn,
  minWidthColumn,
  stickyRightColumn,
  withColumnWidth,
  overflowTitle,
  type TableColumnWidthKey
} from './columns'
