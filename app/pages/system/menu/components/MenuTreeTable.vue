<script setup lang="ts">
import type { Component } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { MenuTreeNode, SysMenuDto } from '#shared/system/menu'
import { useSelectionColumn } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'

const { $ts } = useI18n()

const props = defineProps<{
  items: MenuTreeNode[]
  loading?: boolean
  pagination: { page: number, pageSize: number, total: number }
  pageSizeOptions?: number[]
  loadedChildIds?: Set<string>
  childLoadingIds?: Set<string>
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

const typeMeta: Record<number, { labelKey: string, color: 'primary' | 'success' | 'warning' }> = {
  0: { labelKey: 'module.system.menu.type.directory', color: 'primary' },
  1: { labelKey: 'module.system.menu.type.menu', color: 'success' },
  2: { labelKey: 'module.system.menu.type.button', color: 'warning' }
}

const statusMeta: Record<number, { labelKey: string, color: 'success' | 'warning' }> = {
  1: { labelKey: 'page.manage.common.status.enable', color: 'success' },
  2: { labelKey: 'page.manage.common.status.disable', color: 'warning' }
}

const hiddenMeta: Record<number, { labelKey: string, color: 'error' | 'neutral' }> = {
  0: { labelKey: 'common.yesOrNo.yes', color: 'error' },
  1: { labelKey: 'common.yesOrNo.no', color: 'neutral' }
}

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

const columns = computed<TableColumn<MenuTreeNode>[]>(() => [
  ...(props.canDel ? [menuSelectionColumn.value] : []),
  {
    accessorKey: 'id',
    header: 'ID',
    ...stableColumn(90)
  },
  {
    accessorKey: 'type',
    header: $ts('module.system.menu.menuType'),
    ...stableColumn(88)
  },
  {
    accessorKey: 'name',
    header: $ts('module.system.menu.menuName'),
    ...minWidthColumn(160)
  },
  {
    accessorKey: 'icon',
    header: $ts('module.system.menu.icon'),
    ...stableColumn(64)
  },
  {
    accessorKey: 'code',
    header: $ts('module.system.menu.routeName')
  },
  {
    accessorKey: 'path',
    header: $ts('module.system.menu.routePath')
  },
  {
    accessorKey: 'visible',
    header: $ts('module.system.menu.hideInMenu'),
    ...stableColumn(88)
  },
  {
    accessorKey: 'status',
    header: $ts('module.system.menu.menuStatus'),
    ...stableColumn(88)
  },
  {
    accessorKey: 'parentId',
    header: $ts('module.system.menu.parentId'),
    ...stableColumn(90)
  },
  {
    accessorKey: 'sortOrder',
    header: $ts('module.system.menu.order'),
    ...stableColumn(64)
  },
  {
    id: 'actions',
    header: $ts('common.operate'),
    ...stableColumn(260)
  }
])

const isExpanded = (id?: string | null) => Boolean(id && expanded.value[id])
const isLoadingChildren = (id?: string | null) => Boolean(id && props.childLoadingIds?.has(id))
const isLoadedChildren = (id?: string | null) => Boolean(id && props.loadedChildIds?.has(id))
const canExpandRow = (row: MenuTreeNode) => {
  if (!row.id || row.type !== 0) {
    return false
  }

  return !isLoadedChildren(row.id) || row.children.length > 0
}

const toggleRow = (row: MenuTreeNode) => {
  if (!row.id || !canExpandRow(row)) {
    return
  }

  const nextExpanded = !expanded.value[row.id]
  if (nextExpanded && !isLoadedChildren(row.id)) {
    emit('loadChildren', row)
  }

  expanded.value = {
    ...expanded.value,
    [row.id]: nextExpanded
  }
}

watch([() => props.items, visibleRows], () => {
  checkedRowKeys.value = checkedRowKeys.value.filter(id => visibleRows.value.some(row => row.id === id))
}, { immediate: true })

const handleBatchDelete = () => {
  if (checkedRowKeys.value.length === 0) {
    return
  }
  emit('batchDelete', checkedRowKeys.value)
}

</script>

<template>
  <TableWithPagination
    ref="table"
    :data="visibleRows"
    :columns="columns"
    :loading="loading"
    :pagination="pagination"
    :page-size-options="pageSizeOptions"
    :ui="{ base: 'table-fixed w-full min-w-[1120px]', th: 'overflow-hidden whitespace-nowrap', td: 'overflow-hidden' }"
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

    <template #id-cell="{ row }">
      <div class="flex min-w-0 items-center gap-2">
        <UButton
          v-if="row.original.type === 0"
          :icon="isLoadingChildren(row.original.id) ? 'i-lucide-loader-circle' : isExpanded(row.original.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          variant="ghost"
          color="neutral"
          size="xs"
          square
          :loading="isLoadingChildren(row.original.id)"
          :disabled="!canExpandRow(row.original)"
          @click="toggleRow(row.original)"
        />
        <span v-else class="inline-block size-7 flex-none" />
        <span class="inline-block min-w-0 flex-1 truncate text-muted">{{ row.original.id || '-' }}</span>
      </div>
    </template>

    <template #name-cell="{ row }">
      <div class="flex min-w-0 items-center gap-2" :style="{ paddingLeft: `${row.original.level * 18}px` }">
        <span class="truncate font-medium text-default">{{ row.original.name }}</span>
      </div>
    </template>

    <template #icon-cell="{ row }">
      <div class="flex justify-center">
        <UIcon v-if="row.original.icon" :name="row.original.icon" class="size-4 flex-none text-muted" />
        <span v-else class="text-muted">-</span>
      </div>
    </template>

    <template #type-cell="{ row }">
        <UBadge :color="typeMeta[row.original.type ?? 1]?.color || 'neutral'" variant="soft">
          {{ $ts(typeMeta[row.original.type ?? 1]?.labelKey || 'module.system.menu.type.menu') }}
        </UBadge>
    </template>

    <template #code-cell="{ row }">
      <span class="inline-block w-full truncate font-mono text-xs text-default">{{ row.original.code }}</span>
    </template>

    <template #path-cell="{ row }">
      <span class="inline-block w-full truncate text-muted">{{ row.original.path || '-' }}</span>
    </template>

    <template #visible-cell="{ row }">
      <UBadge :color="hiddenMeta[row.original.visible ?? 1]?.color || 'neutral'" variant="soft">
        {{ $ts(hiddenMeta[row.original.visible ?? 1]?.labelKey || 'common.yesOrNo.no') }}
      </UBadge>
    </template>

    <template #status-cell="{ row }">
      <UBadge :color="statusMeta[row.original.status ?? 1]?.color || 'neutral'" variant="soft">
        {{ $ts(statusMeta[row.original.status ?? 1]?.labelKey || 'page.manage.common.status.enable') }}
      </UBadge>
    </template>

    <template #parentId-cell="{ row }">
      <span class="inline-block w-full truncate text-muted">{{ row.original.parentId || '0' }}</span>
    </template>

    <template #actions-cell="{ row }">
      <div class="flex justify-end gap-1 whitespace-nowrap">
        <UTooltip v-if="canAdd && row.original.type === 0" :text="$ts('module.system.menu.addChildMenu')">
          <UButton icon="i-lucide-plus" variant="outline" size="xs" @click="emit('addChild', row.original)">
            {{ $ts('module.system.menu.addChildMenu') }}
          </UButton>
        </UTooltip>
        <UTooltip v-if="canEdit" :text="$ts('common.edit')">
          <UButton icon="i-lucide-pencil" variant="outline" size="xs" @click="emit('edit', row.original)">
            {{ $ts('common.edit') }}
          </UButton>
        </UTooltip>
        <Popconfirm v-if="canDel" @confirm="emit('remove', row.original)">
          <template #trigger>
            <UButton icon="i-lucide-trash-2" variant="outline" color="error" size="xs">
              {{ $ts('common.delete') }}
            </UButton>
          </template>
        </Popconfirm>
      </div>
    </template>
  </TableWithPagination>
</template>
