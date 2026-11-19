<template>
  <div class="flex h-full flex-col gap-3 p-3">
    <div class="shrink-0">
      <SysPostSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
    </div>

    <UCard class="flex min-h-0 flex-1 flex-col overflow-hidden" :ui="{ body: 'flex h-full flex-col p-0 sm:p-0' }">
      <TableWithPagination
          ref="table"
          :data="data"
          :columns="columns"
          :loading="loading"
          :pagination="pagination"
          :page-size-options="pageSizeOptions"
          compact-mobile
          :mobile-row-actions="rowActions"
      >
        <template #header>
          <TableHeaderOperation
              v-if="tableRef?.tableRef"
              :table-ref="tableRef?.tableRef"
              :loading="loading"
              :disabled-delete="checkedRowKeys.length === 0 || loading"
              :selected-count="checkedRowKeys.length"
              :add-permission="postPermissions.codes.add"
              :delete-permission="postPermissions.codes.del"
              compact-mobile
              class="shrink-0 border-b border-gray-200 px-4 py-2 dark:border-gray-800"
              @add="handleAdd"
              @delete="handleBatchDelete"
              @refresh="refresh"
          >
            <template #prefix>
              <span class="hidden md:inline">{{ $ts('module.system.post.title') }}</span>
            </template>
            <template #suffix>
              <UButton
                  v-if="postPermissions.canList.value"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-download"
                  :aria-label="$ts('module.system.excel.export')"
                  :title="$ts('module.system.excel.export')"
                  @click="handleExport"
              >
                <span class="hidden md:inline">{{ $ts('module.system.excel.export') }}</span>
              </UButton>
            </template>
          </TableHeaderOperation>

          <SysPostOperate
              v-model:visible="drawerVisible"
              :operate-type="operateType"
              :data="editingData ?? undefined"
              :close="closeVisible"
              :refresh="refresh"
          />
        </template>
      </TableWithPagination>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Component } from 'vue'
import { h } from 'vue'
import type { SysPostDto, SysPostQueryDTO } from '#admin/shared/system/post'
import { businessDictCode } from '#admin/shared/constants/business'
import TableWithPagination from '#admin/app/components/table/TableWithPagination.vue'
import { useBadgeColumn, usePaginatedTable, useSelectionColumn, useTableOperate } from '#admin/app/composables/useTable'
import type { MobileRowAction } from '#admin/app/composables/useTable'
import { downloadExcel } from '#admin/app/utils/excel'
import SysPostSearch from './components/sys-post-search.vue'
import SysPostOperate from './components/sys-post-operate.vue'

definePageMeta({
  layout: 'system',
  title: '岗位管理',
  icon: 'i-lucide-briefcase-business',
})

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const postPermissions = useCrudPermissions('system:post')
const enableStatusConfig = useDictBadgeConfig(businessDictCode.enableStatus)
const searchParams = ref<SysPostQueryDTO>({})

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage,
} = usePaginatedTable<SysPostDto>({
  query: params => $trpc.sysPost.page.query(params),
  pageSizeOptions: [10, 20, 50, 100],
})

const {
  operateType,
  editingData,
  drawerVisible,
  checkedRowKeys,
  handleAdd,
  handleEdit,
  onDeleted,
  onBatchDeleted,
  closeVisible,
} = useTableOperate<SysPostDto>({
  data,
  idKey: 'id',
  refresh,
})

const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysPostDto>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component,
})

const columns = computed<TableColumn<SysPostDto>[]>(() => {
  const actionColumn: TableColumn<SysPostDto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      if (postPermissions.canEdit.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          icon: 'i-ic-round-edit',
          onClick: () => handleEdit(row.original.id as string),
        }, { default: () => $ts('common.edit') }))
      }

      if (postPermissions.canDel.value) {
        actions.push(h(Popconfirm, {
          onConfirm: () => handleDelete(row.original.id as string),
        }, {
          trigger: () => h(UButton, {
            variant: 'outline',
            color: 'error',
            size: 'xs',
            icon: 'i-ic-round-delete',
          }, { default: () => $ts('common.delete') }),
        }))
      }

      return h('div', { class: 'flex gap-2' }, actions)
    },
  }

  return [
    ...(postPermissions.canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => h('span', { class: 'text-gray-500 dark:text-gray-400' }, (pagination.page - 1) * pagination.pageSize + row.index + 1),
    },
    {
      accessorKey: 'code',
      header: () => $ts('module.system.post.code'),
    },
    {
      accessorKey: 'name',
      header: () => $ts('module.system.post.name'),
    },
    {
      accessorKey: 'sortOrder',
      header: () => $ts('module.system.post.sortOrder'),
    },
    useBadgeColumn<SysPostDto>(
      'status',
      'module.system.post.status',
      enableStatusConfig.value,
      1,
    ),
    {
      accessorKey: 'remark',
      header: () => $ts('module.system.post.remark'),
    },
    ...(postPermissions.canOperate.value ? [actionColumn] : []),
  ]
})

/** 移动端行操作：点击行弹出底部操作面板 */
const rowActions = (row: SysPostDto): MobileRowAction[] => {
  const items: MobileRowAction[] = []

  if (postPermissions.canEdit.value) {
    items.push({
      label: $ts('common.edit'),
      icon: 'i-lucide-pencil',
      color: 'primary',
      onSelect: () => handleEdit(row.id as string),
    })
  }

  if (postPermissions.canDel.value) {
    items.push({
      label: $ts('common.delete'),
      icon: 'i-lucide-trash-2',
      color: 'error',
      confirm: $ts('common.confirmDelete', { count: 1 }),
      onSelect: () => handleDelete(row.id as string),
    })
  }

  return items
}

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysPost.remove.mutate(id)
  await onDeleted()
}

const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) return
  await $trpc.sysPost.batchDelete.mutate(checkedRowKeys.value)
  await onBatchDeleted()
}

const handleExport = async () => {
  await downloadExcel('post', { ...searchParams.value })
}

onMounted(async () => {
  await search()
})
</script>

<style scoped>
@media (max-width: 640px) {
  :deep(table) {
    display: table;
    min-width: 760px;
    width: 100%;
  }
}
</style>
