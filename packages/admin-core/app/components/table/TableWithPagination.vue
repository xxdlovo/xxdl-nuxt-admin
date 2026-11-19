<template>
  <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
    <!-- 表头操作栏 -->
    <slot name="header" />

    <!-- 表格容器 -->
    <div
        ref="scrollRef"
        class="flex-1 overflow-auto px-4 min-h-0 relative table-scroll-container"
        :class="{ 'hide-expanded-slot-row': hideExpandedSlotRow }"
        :style="minTableWidth ? { '--table-min-width': `${minTableWidth}px` } : undefined"
    >
      <!-- Loading 遮罩 -->
      <div
          v-if="loading"
          class="absolute inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-10"
      >
        <div class="flex flex-col items-center gap-3">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-primary animate-spin" />
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ $ts('common.loading') }}</span>
        </div>
      </div>

      <UTable
          ref="tableRef"
          :data="data"
          :columns="renderedColumns"
          :loading="loading"
          :ui="tableUi"
          :get-sub-rows="getSubRows"
          :get-row-id="getRowId"
          :expanded-options="expandedOptions"
          v-model:expanded="expanded"
          sticky
          class="min-w-full h-full"
      >
        <template v-for="(_, name) in tableSlots" :key="name" #[name]="slotData">
          <slot :name="name" v-bind="slotData" />
        </template>
      </UTable>

      <!-- 行操作二次确认 -->
      <UModal
        v-if="confirmAction"
        v-model:open="confirmOpen"
        :title="$ts('common.confirm')"
        :ui="{ content: 'max-w-sm' }"
      >
        <template #body>
          <p class="text-sm text-default">{{ confirmAction.confirm }}</p>
        </template>
        <template #footer>
          <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" @click="confirmOpen = false" />
          <UButton :label="$ts('common.confirm')" color="error" @click="confirmActionRun" />
        </template>
      </UModal>
    </div>

    <!-- 分页 -->
    <div
        class="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
        :class="isMobile ? 'px-2 py-1' : 'px-4 py-2'"
    >
      <div class="flex items-center justify-end" :class="isMobile ? 'gap-1' : 'gap-2'">
        <!-- 总数 -->
        <div class="hidden sm:block text-sm text-gray-700 dark:text-gray-300">
          {{ $ts('datatable.itemCount', { total: pagination.total }) }}
        </div>

        <!-- 每页条数选择 -->
        <USelect
            v-model="pagination.pageSize"
            :items="pageSizeOptions"
            :size="isMobile ? 'xs' : 'sm'"
            :disabled="loading"
            :class="isMobile ? 'w-14' : 'w-16 sm:w-20'"
        />

        <!-- 分页器：移动端使用最小号 -->
        <UPagination
            v-model:page="pagination.page"
            :items-per-page="pagination.pageSize"
            :total="pagination.total"
            :max="isMobile ? 3 : 5"
            :size="isMobile ? 'xs' : 'sm'"
            :disabled="loading"
            show-first
            show-last
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import type { TableColumn, TableRow } from '@nuxt/ui'
import type { ExpandedOptions, ExpandedState } from '@tanstack/vue-table'
import { h } from 'vue'
import type { MobileRowAction } from '#admin/app/composables/useTable'
import { stableColumn, stickyRightColumn, tableColumnWidth } from '#admin/app/composables/useTable/columns'

interface Pagination {
  page: number
  pageSize: number
  total: number
}

interface Props {
  data: T[]
  columns: TableColumn<T>[]
  loading?: boolean
  pagination: Pagination
  pageSizeOptions?: number[]
  ui?: Record<string, unknown>
  getSubRows?: (originalRow: T, index: number) => T[] | undefined
  getRowId?: (originalRow: T, index: number, parent?: TableRow<T>) => string
  expandedOptions?: Omit<ExpandedOptions<T>, 'getExpandedRowModel' | 'onExpandedChange'>
  hideExpandedSlotRow?: boolean
  /**
   * 移动端精简表格：<768px 时只渲染 mobileColumns 指定的列 + 操作列，
   * 并关闭 table-fixed / 最小宽度 / 操作列吸附，避免窄屏下内容列被操作列遮住。
   */
  compactMobile?: boolean
  /** 移动端保留的列 id（compactMobile 生效时使用） */
  mobileColumns?: string[]
  /** 移动端操作列宽度（px） */
  mobileActionsWidth?: number
  /**
   * 移动端行操作：传入后移动端隐藏「操作」列，点击行弹出底部操作面板。
   * 返回空数组时该行不可点击。
   */
  mobileRowActions?: (row: T) => MobileRowAction[]
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  pageSizeOptions: () => [10, 20, 50, 100],
  hideExpandedSlotRow: false,
  compactMobile: false,
  mobileActionsWidth: 140
})

const expanded = defineModel<ExpandedState>('expanded', {
  default: () => ({})
})
const tableRef = useTemplateRef('tableRef')
const { $ts } = useI18n()
const slots = useSlots()
const tableSlots = computed(() => {
  const { header: _header, ...rest } = slots
  return rest
})

/** 移动端断点：与 Tailwind md 保持一致 */
const isMobile = useIsMobile()
const scrollRef = useTemplateRef<HTMLElement>('scrollRef')
const containerWidth = ref(0)
let resizeObserver: ResizeObserver | null = null

const measureContainer = () => {
  containerWidth.value = scrollRef.value?.clientWidth ?? 0
}

onMounted(() => {
  measureContainer()
  if (typeof ResizeObserver !== 'undefined' && scrollRef.value) {
    resizeObserver = new ResizeObserver(() => measureContainer())
    resizeObserver.observe(scrollRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

const compactMode = computed(() => props.compactMobile && isMobile.value)

const columnId = (column: TableColumn<T>) =>
  String(column.id ?? (column as { accessorKey?: string }).accessorKey ?? '')

/**
 * 统一表格外观：
 * - table-fixed：列宽稳定，避免长内容把表格撑宽、把操作列挤出视口
 * - th whitespace-nowrap：中文表头不折行
 * - td overflow-hidden：配合列宽做截断，内容完整性由 title/复制入口保证
 * 页面可通过 ui 覆盖任意键。
 */
const tableUi = computed(() => {
  const custom = props.ui ?? {}
  const base = ['table-fixed', custom.base].filter(Boolean).join(' ')
  // 移动端精简模式减小单元格内边距，把宽度留给内容
  const horizontalPadding = compactMode.value ? 'px-2' : ''

  return {
    base,
    th: ['whitespace-nowrap', horizontalPadding, custom.th].filter(Boolean).join(' '),
    td: ['overflow-hidden align-middle', horizontalPadding, custom.td].filter(Boolean).join(' '),
    ...custom
  } as Record<string, unknown>
})

/**
 * 规范化列宽：
 * - 选择列 / 序号列：固定窄宽
 * - 操作列：固定宽度 + 右侧吸附，横向滚动时始终可见
 * - 其他列：未显式设置宽度时保持均分（table-fixed 下自动铺满容器）
 */
const normalizedColumns = computed<TableColumn<T>[]>(() => {
  return props.columns.map((column, index) => {
    const id = String(column.id ?? (column as { accessorKey?: string }).accessorKey ?? '')
    const isSelection = index === 0 && (id === 'select' || id === 'selection')
    const isIndex = id === 'index'
    const isAction = id === 'actions'

    if (isSelection) {
      return mergeColumn(column, stableColumn(tableColumnWidth.selection))
    }

    if (isIndex) {
      return mergeColumn(column, stableColumn(tableColumnWidth.index))
    }

    if (isAction) {
      return mergeColumn(column, stickyRightColumn(tableColumnWidth.actions))
    }

    return column
  })
})

/**
 * 实际渲染的列：
 * 移动端精简模式下只保留 mobileColumns 指定的列 + 操作列，
 * 并去掉操作列的 sticky（窄屏下吸附会直接盖住内容列）。
 * 传入 mobileRowActions 时移动端隐藏操作列，改由点击行弹出操作面板。
 */
const renderedColumns = computed<TableColumn<T>[]>(() => {
  if (!compactMode.value) {
    return normalizedColumns.value
  }

  const hideActions = Boolean(props.mobileRowActions)
  const allow = new Set(props.mobileColumns ?? [])
  // 未指定 mobileColumns 时保留全部列，交给横向滚动查看
  const filtered = normalizedColumns.value
    .filter(column => columnId(column) === 'actions' || allow.size === 0 || allow.has(columnId(column)))
    .map((column) => {
      if (!hideActions || columnId(column) !== 'actions') {
        return column
      }

      // 移动端操作列：只保留一个「更多」入口，点击打开操作面板（右侧吸附，始终可见）
      const width = 56
      return {
        ...column,
        header: () => $ts('common.operate'),
        size: width,
        minSize: width,
        meta: {
          style: {
            th: { width: `${width}px`, minWidth: `${width}px` },
            td: { width: `${width}px`, minWidth: `${width}px` }
          }
        },
        cell: ({ row }: any) => {
          const actions = props.mobileRowActions?.(row.original as T) ?? []
          if (!actions.length) {
            return null
          }

          const items = actions.map(action => ({
            label: action.label,
            icon: action.icon,
            color: action.color,
            disabled: action.disabled,
            onSelect: () => handleMobileAction(action)
          }))

          return h(resolveComponent('UDropdownMenu'), {
            items,
            content: { align: 'end' }
          }, {
            default: () => h(resolveComponent('UButton'), {
              icon: 'i-lucide-ellipsis',
              color: 'primary',
              variant: 'outline',
              size: 'xs',
              square: true,
              'aria-label': $ts('common.operate')
            })
          })
        }
      } as TableColumn<T>
    })

  const hasActions = filtered.some(column => columnId(column) === 'actions')
  const dataCount = filtered.length - (hasActions ? 1 : 0)

  const withMobileWidth = (column: TableColumn<T>, width: number): TableColumn<T> => {
    // 统一宽度，并清掉桌面端的 sticky 样式
    return {
      ...column,
      size: width,
      minSize: width,
      meta: {
        style: {
          th: { width: `${width}px`, minWidth: `${width}px` },
          td: { width: `${width}px`, minWidth: `${width}px` }
        }
      }
    } as TableColumn<T>
  }

  // 全列模式：保留页面定义的列宽；操作列已在上面替换为「更多」入口
  if (allow.size === 0) {
    return filtered
  }

  // 精简模式：容器内边距 px-4，剩余宽度均分给数据列
  const available = Math.max((containerWidth.value || 390) - 32, 240)
  const dataWidth = dataCount > 0
    ? Math.max(88, Math.floor((available - 56) / dataCount))
    : 0

  return filtered.map(column =>
    columnId(column) === 'actions' ? column : withMobileWidth(column, dataWidth)
  )
})

/**
 * 表格最小宽度 = 各列宽度之和。
 * 移动端精简（裁剪列）时不需要最小宽度；移动端全列模式仍需按列宽总和撑开，靠横向滚动查看。
 */
const minTableWidth = computed(() => {
  const trimmed = compactMode.value && (props.mobileColumns?.length ?? 0) > 0
  if (trimmed) {
    return 0
  }

  const total = renderedColumns.value.reduce((sum, column) => {
    const width = column.size ?? column.minSize
    return sum + (typeof width === 'number' && width > 0 ? width : 140)
  }, 0)

  return Math.max(total, 100)
})

/* ---------------- 移动端行操作 ---------------- */

const confirmAction = ref<MobileRowAction | null>(null)
const confirmOpen = ref(false)

const handleMobileAction = (action: MobileRowAction) => {
  if (action.disabled) {
    return
  }

  if (action.confirm) {
    confirmAction.value = action
    confirmOpen.value = true
    return
  }

  action.onSelect()
}

const confirmActionRun = () => {
  const action = confirmAction.value
  confirmOpen.value = false
  confirmAction.value = null
  action?.onSelect()
}

function mergeColumn(
  column: TableColumn<T>,
  extra: { size?: number, minSize?: number, meta?: Record<string, unknown> }
): TableColumn<T> {
  const currentMeta = (column.meta ?? {}) as Record<string, unknown>
  const extraMeta = (extra.meta ?? {}) as Record<string, unknown>
  const currentClass = currentMeta.class as Record<string, string> | undefined
  const extraClass = extraMeta.class as Record<string, string> | undefined

  return {
    ...column,
    size: column.size ?? extra.size,
    minSize: column.minSize ?? extra.minSize,
    meta: {
      ...extraMeta,
      ...currentMeta,
      class: currentClass && extraClass ? { ...extraClass, ...currentClass } : (currentClass ?? extraClass),
      style: (currentMeta.style as Record<string, unknown> | undefined) ?? (extraMeta.style as Record<string, unknown> | undefined)
    }
  } as TableColumn<T>
}

// 暴露 tableRef 给父组件
defineExpose({
  tableRef
})
</script>

<style scoped>
.hide-expanded-slot-row :deep(tr[data-slot="tr"]:has(> td[colspan]:empty)) {
  display: none;
}

/* 预留滚动条槽位，避免纵向滚动条压住最后一列内容 */
.table-scroll-container {
  scrollbar-gutter: stable;
}

/* 列宽总和决定表格最小宽度：容器更宽时表格铺满（列等比变宽），
   容器更窄时保持列宽不被压缩，由容器横向滚动承接 */
.table-scroll-container :deep(table) {
  min-width: max(100%, var(--table-min-width, 0px));
}
</style>
