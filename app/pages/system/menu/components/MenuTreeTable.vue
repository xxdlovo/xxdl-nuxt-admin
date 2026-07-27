<script setup lang="ts">
import { h, type Component } from 'vue'
import type { TableColumn, TableRow } from '@nuxt/ui'
import type { MenuTreeNode, SysMenuDto } from '#shared/system/menu'
import { ENABLE_STATUS_CONFIG, YES_NO_CONFIG, menuTypeConfig } from '#shared/constants/business'
import { useBadgeColumn, useSelectionColumn } from '~/composables/useTable'
import { displayOrDash, isPresent } from '~/utils/common'
import TableWithPagination from '~/components/table/TableWithPagination.vue'

const { $ts } = useI18n()

const props = defineProps<{
  items: MenuTreeNode[]
  loading?: boolean
  pagination: { page: number, pageSize: number, total: number }
  pageSizeOptions?: number[]
  loadedChildIds?: Set<string>
  childLoadingIds?: Set<string>
  resetKey?: number
  canAdd?: boolean
  canEdit?: boolean
  canDel?: boolean
  addPermission?: string | string[]
  deletePermission?: string | string[]
}>()

const emit = defineEmits<{
  add: []
  addChild: [row: SysMenuDto]
  batchDelete: [ids: string[]]
  edit: [row: SysMenuDto]
  loadChildren: [row: SysMenuDto]
  remove: [row: SysMenuDto]
  refresh: []
}>()

const expanded = ref<Record<string, boolean>>({})
const tableRef = useTemplateRef('table')
const checkedRowKeys = ref<string[]>([])
const UCheckbox = resolveComponent('UCheckbox')
const UButton = resolveComponent('UButton')
const UIcon = resolveComponent('UIcon')
const UTooltip = resolveComponent('UTooltip')
const Popconfirm = resolveComponent('Popconfirm')

const stableColumn = (width: number) => ({
  size: width,
  minSize: width,
  meta: {
    style: {
      th: { width: `${width}px`, minWidth: `${width}px` },
      td: { width: `${width}px`, minWidth: `${width}px` }
    }
  }
})

const minWidthColumn = (width: number) => ({
  minSize: width,
  meta: {
    style: {
      th: { minWidth: `${width}px` },
      td: { minWidth: `${width}px` }
    }
  }
})

const visibleRows = computed(() => {
  const rows: MenuTreeNode[] = []

  const walk = (nodes: MenuTreeNode[]) => {
    nodes.forEach((node) => {
      rows.push(node)

      if (node.id && expanded.value[node.id]) {
        walk(node.children)
      }
    })
  }

  walk(props.items)
  return rows
})

const { selectionColumn } = useSelectionColumn<MenuTreeNode>({
  data: visibleRows,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

const menuSelectionColumn = computed<TableColumn<MenuTreeNode>>(() => ({
  ...selectionColumn,
  ...stableColumn(48)
}))

const isLoadingChildren = (id?: string | null) => Boolean(id && props.childLoadingIds?.has(id))
const isLoadedChildren = (id?: string | null) => Boolean(id && props.loadedChildIds?.has(id))
const getSubRows = (row: MenuTreeNode) => row.children?.length ? row.children : undefined
const getRowId = (row: MenuTreeNode) => row.id ?? ''
const expandedOptions = {
  getRowCanExpand: (row: { original: MenuTreeNode }) => {
    const id = row.original.id
    if (!id) {
      return false
    }

    if (row.original.children.length > 0) {
      return true
    }

    return !isLoadedChildren(id)
  }
}

const handleToggleExpanded = (row: TableRow<MenuTreeNode>) => {
  if (!row.original.id || !row.getCanExpand()) {
    return
  }

  if (!row.getIsExpanded() && !isLoadedChildren(row.original.id)) {
    emit('loadChildren', row.original)
  }

  row.getToggleExpandedHandler()()
}

const handleBatchDelete = () => {
  if (checkedRowKeys.value.length === 0) {
    return
  }

  emit('batchDelete', checkedRowKeys.value)
}

const renderTextCell = (value: unknown, className = 'text-muted') => {
  return h('span', { class: `inline-block w-full truncate ${className}` }, displayOrDash(value))
}

const columns = computed<TableColumn<MenuTreeNode>[]>(() => [
  ...(props.canDel ? [menuSelectionColumn.value] : []),
  {
    accessorKey: 'sortOrder',
    header: $ts('module.system.menu.order'),
    cell: ({ row }) => h('div', {
      class: 'flex min-w-0 items-center gap-2',
      style: { paddingLeft: `${row.depth * 16}px` }
    }, [
      row.getCanExpand()
        ? h(UButton, {
            color: 'neutral',
            variant: 'outline',
            size: 'xs',
            icon: row.getIsExpanded() ? 'i-lucide-minus' : 'i-lucide-plus',
            loading: isLoadingChildren(row.original.id),
            class: !row.getCanExpand() && 'invisible',
            ui: {
              base: 'p-0 rounded-sm',
              leadingIcon: 'size-4'
            },
            onClick: () => handleToggleExpanded(row)
          })
        : h('span', { class: 'inline-block size-7 flex-none' }),
      h('span', { class: 'inline-block min-w-0 flex-1 truncate text-muted' }, displayOrDash(row.original.sortOrder ?? 0))
    ]),
    ...stableColumn(132)
  },
  {
    ...useBadgeColumn<MenuTreeNode>('type', 'module.system.menu.menuType', menuTypeConfig, 1),
    ...stableColumn(88)
  },
  {
    accessorKey: 'name',
    header: $ts('module.system.menu.menuName'),
    cell: ({ row }) => h('div', { class: 'flex min-w-0 items-center gap-2' }, [
      h('span', { class: 'truncate font-medium text-default' }, displayOrDash(row.original.name))
    ]),
    ...minWidthColumn(160)
  },
  {
    accessorKey: 'icon',
    header: $ts('module.system.menu.icon'),
    cell: ({ row }) => h('div', { class: 'flex justify-center' }, [
      isPresent(row.original.icon)
        ? h(UIcon, { name: normalizeNavigationIcon(row.original.icon), class: 'size-4 flex-none text-muted' })
        : h('span', { class: 'text-muted' }, '-')
    ]),
    ...stableColumn(64)
  },
  {
    accessorKey: 'code',
    header: $ts('module.system.menu.routeName'),
    cell: ({ row }) => renderTextCell(row.original.code, 'font-mono text-xs text-default'),
    ...minWidthColumn(140)
  },
  {
    accessorKey: 'path',
    header: $ts('module.system.menu.routePath'),
    cell: ({ row }) => renderTextCell(row.original.path),
    ...minWidthColumn(160)
  },
  {
    ...useBadgeColumn<MenuTreeNode>('visible', 'module.system.menu.hideInMenu', YES_NO_CONFIG, 1),
    ...stableColumn(88)
  },
  {
    ...useBadgeColumn<MenuTreeNode>('status', 'module.system.menu.menuStatus', ENABLE_STATUS_CONFIG, 1),
    ...stableColumn(88)
  },
  {
    id: 'actions',
    header: $ts('common.operate'),
    cell: ({ row }) => h('div', { class: 'flex justify-end gap-1 whitespace-nowrap' }, [
      props.canAdd && row.original.type === 0
        ? h(UTooltip, { text: $ts('module.system.menu.addChildMenu') }, {
            default: () => h(UButton, {
              icon: 'i-lucide-plus',
              variant: 'outline',
              size: 'xs',
              onClick: () => emit('addChild', row.original)
            }, { default: () => $ts('module.system.menu.addChildMenu') })
          })
        : null,
      props.canEdit
        ? h(UTooltip, { text: $ts('common.edit') }, {
            default: () => h(UButton, {
              icon: 'i-lucide-pencil',
              variant: 'outline',
              size: 'xs',
              onClick: () => emit('edit', row.original)
            }, { default: () => $ts('common.edit') })
          })
        : null,
      props.canDel
        ? h(Popconfirm, { onConfirm: () => emit('remove', row.original) }, {
            trigger: () => h(UButton, {
              icon: 'i-lucide-trash-2',
              variant: 'outline',
              color: 'error',
              size: 'xs'
            }, { default: () => $ts('common.delete') })
          })
        : null
    ]),
    ...stableColumn(260)
  }
])

watch([() => props.items, visibleRows], () => {
  checkedRowKeys.value = checkedRowKeys.value.filter(id => visibleRows.value.some(row => row.id === id))
}, { immediate: true })

watch(() => props.resetKey, () => {
  expanded.value = {}
})
</script>

<template>
  <TableWithPagination
    ref="table"
    v-model:expanded="expanded"
    :data="items"
    :columns="columns"
    :loading="loading"
    :pagination="pagination"
    :page-size-options="pageSizeOptions"
    :get-sub-rows="getSubRows"
    :get-row-id="getRowId"
    :expanded-options="expandedOptions"
    :ui="{ base: 'table-fixed w-full min-w-[1126px]', th: 'overflow-hidden whitespace-nowrap', td: 'empty:p-0 overflow-hidden' }"
  >
    <template #header>
      <TableHeaderOperation
        v-if="tableRef?.tableRef"
        :table-ref="tableRef?.tableRef"
        :loading="loading"
        :disabled-delete="checkedRowKeys.length === 0 || loading"
        :selected-count="checkedRowKeys.length"
        :add-permission="addPermission"
        :delete-permission="deletePermission"
        class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
        @add="emit('add')"
        @delete="handleBatchDelete"
        @refresh="emit('refresh')"
      >
        <template #prefix>
          <span>{{ $ts('module.system.menu.title') }}</span>
        </template>
      </TableHeaderOperation>
    </template>

    <template #empty>
      <UEmpty icon="i-lucide-database-zap" :title="$ts('common.noData')" class="py-16" />
    </template>
  </TableWithPagination>
</template>
