/**
 * 表格列宽工具
 *
 * 统一列表表格模板的列宽策略，避免列宽完全由浏览器自动分配导致：
 * - 表头折行、行高膨胀
 * - 长内容把表格撑宽，操作列被挤出可视区
 * - 各页面列宽标准不一致
 */

import type { TableColumn } from '@nuxt/ui'

/**
 * 常用列宽（单位 px）
 * 取值参考 1364 宽度下各字段的中文表头长度与内容长度。
 */
export const tableColumnWidth = {
  selection: 48,
  index: 64,
  actions: 200,
  time: 168,
  code: 200,
  text: 160,
  status: 96,
  amount: 112,
  number: 80,
  badge: 96,
  icon: 72
} as const

export type TableColumnWidthKey = keyof typeof tableColumnWidth

interface ColumnStyleMeta {
  th?: Record<string, string>
  td?: Record<string, string>
}

interface ColumnClassMeta {
  th?: string
  td?: string
}

interface ColumnMetaLike {
  class?: ColumnClassMeta | ((ctx: unknown) => string)
  style?: ColumnStyleMeta | ((ctx: unknown) => Record<string, string>)
  [key: string]: unknown
}

/**
 * 固定宽度列：宽高不随内容变化
 */
export function stableColumn(width: number) {
  return {
    size: width,
    minSize: width,
    meta: {
      style: {
        th: { width: `${width}px`, minWidth: `${width}px` },
        td: { width: `${width}px`, minWidth: `${width}px` }
      }
    }
  }
}

/**
 * 内容列宽度：给定一个可读的最小宽度，并固定下来。
 * table-fixed 下如果只给 minWidth 而不给 width，列会被摊分到剩余空间，
 * 导致同页不同列宽差异过大、表格整体过宽，所以两处都设置。
 */
export function minWidthColumn(width: number) {
  return {
    size: width,
    minSize: width,
    meta: {
      style: {
        th: { width: `${width}px`, minWidth: `${width}px` },
        td: { width: `${width}px`, minWidth: `${width}px` }
      }
    }
  }
}

/**
 * 右侧固定列（用于操作列）：滚动时保持可见。
 * 背景使用表格默认底色（与表头/单元格一致），不额外叠加色块或阴影。
 */
export function stickyRightColumn(width: number = tableColumnWidth.actions) {
  return {
    ...stableColumn(width),
    meta: {
      class: {
        th: 'sticky right-0 z-20 bg-default',
        td: 'sticky right-0 z-10 bg-default'
      },
      style: {
        th: { width: `${width}px`, minWidth: `${width}px` },
        td: { width: `${width}px`, minWidth: `${width}px` }
      }
    }
  }
}

/**
 * 合并列定义与宽度配置（页面已有的 meta 优先）
 */
export function withColumnWidth<T>(
  column: TableColumn<T>,
  width: { size?: number, minSize?: number, meta?: Record<string, unknown> }
): TableColumn<T> {
  const currentMeta = (column.meta ?? {}) as ColumnMetaLike
  const targetMeta = (width.meta ?? {}) as ColumnMetaLike

  return {
    ...column,
    size: column.size ?? width.size,
    minSize: column.minSize ?? width.minSize,
    meta: {
      ...targetMeta,
      ...currentMeta,
      class: currentMeta.class ?? targetMeta.class,
      style: currentMeta.style ?? targetMeta.style
    }
  } as TableColumn<T>
}

/**
 * 单元格统一截断 + 悬浮提示（表格内容溢出时仍可读全文）
 * 用法：col.cell = ({ row }) => overflowCell(row.original.name)
 */
export function overflowTitle(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined
  }

  const text = String(value)
  return text.length > 0 ? text : undefined
}
