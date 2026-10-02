<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysMemberLevelSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
    </div>

    <UCard class="flex-1 min-h-0 flex flex-col overflow-hidden" :ui="{ body: 'flex flex-col h-full p-0 sm:p-0' }">
      <TableWithPagination
        ref="table"
        :data="data"
        :columns="columns"
        :loading="loading"
        :pagination="pagination"
        :page-size-options="pageSizeOptions"
      >
        <template #header>
          <TableHeaderOperation
            v-if="tableRef?.tableRef"
            :table-ref="tableRef.tableRef"
            :loading="loading"
            :disabled-delete="checkedRowKeys.length === 0 || loading"
            :selected-count="checkedRowKeys.length"
            :add-permission="levelPermissions.codes.add"
            :delete-permission="levelPermissions.codes.del"
            class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
            @add="handleAdd"
            @delete="handleBatchDelete"
            @refresh="refresh"
          >
            <template #prefix>
              <span>{{ $ts('module.system.memberLevel.title') }}</span>
            </template>
          </TableHeaderOperation>
        </template>
      </TableWithPagination>
    </UCard>

    <!-- 弹窗放在 TableHeaderOperation 之外：填了默认插槽会顶掉组件内置的新增/批量删除按钮 -->
    <SysMemberLevelOperate
      v-model:visible="drawerVisible"
      :operate-type="operateType"
      :data="editingData ?? undefined"
      :close="closeVisible"
      :refresh="refresh"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '会员等级',
  icon: 'i-lucide-medal'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysMemberLevelDto, SysMemberLevelQueryDTO } from '#shared/system/memberLevel'
import type { BadgeConfig } from '#shared/types/nuxtui'
import { usePaginatedTable, useTableOperate, useBadgeColumn, useSelectionColumn } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'
import SysMemberLevelSearch from './components/sys-member-level-search.vue'
import SysMemberLevelOperate from './components/sys-member-level-operate.vue'

/**
 * 等级状态徽标：与 sys_member_level.status 一致（1 启用 / 0 停用）。
 * 状态属于「业务结论」，与 payChannelVerifyConfig 一样用本文常量映射，
 * 不放进可被后台改坏的字典表。
 */
const memberLevelStatusConfig: Readonly<Record<string, BadgeConfig>> = {
  '1': { i18nKey: 'module.system.memberLevel.status.enabled', color: 'success' },
  '0': { i18nKey: 'module.system.memberLevel.status.disabled', color: 'neutral' }
}

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const levelPermissions = useCrudPermissions('system:memberLevel')
const searchParams = ref<SysMemberLevelQueryDTO>({})

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysMemberLevelDto>({
  query: params => $trpc.sysMemberLevel.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

const { operateType, editingData, drawerVisible, checkedRowKeys, handleAdd, handleEdit, onDeleted, onBatchDeleted, closeVisible } = useTableOperate<SysMemberLevelDto>({
  data,
  idKey: 'id',
  refresh
})

const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysMemberLevelDto>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

const columns = computed<TableColumn<SysMemberLevelDto>[]>(() => {
  const actionColumn: TableColumn<SysMemberLevelDto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      if (levelPermissions.canEdit.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          onClick: () => handleEdit(row.original.id as string)
        }, { default: () => $ts('common.edit') }))
      }

      if (levelPermissions.canDel.value) {
        actions.push(h(Popconfirm, {
          onConfirm: () => handleDelete(row.original.id as string)
        }, {
          trigger: () => h(UButton, {
            variant: 'outline',
            color: 'error',
            size: 'xs'
          }, { default: () => $ts('common.delete') })
        }))
      }

      return h('div', { class: 'flex gap-2' }, actions)
    }
  }

  return [
    ...(levelPermissions.canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => h('span', { class: 'text-muted' }, (pagination.page - 1) * pagination.pageSize + row.index + 1)
    },
    {
      accessorKey: 'code',
      header: () => $ts('module.system.memberLevel.code')
    },
    {
      accessorKey: 'name',
      header: () => $ts('module.system.memberLevel.name')
    },
    {
      accessorKey: 'sortOrder',
      header: () => $ts('module.system.memberLevel.sortOrder')
    },
    {
      accessorKey: 'benefit',
      header: () => $ts('module.system.memberLevel.benefit'),
      cell: ({ row }) => row.original.benefit || '-'
    },
    useBadgeColumn<SysMemberLevelDto>('status', 'module.system.memberLevel.statusLabel', memberLevelStatusConfig, 1),
    {
      accessorKey: 'remark',
      header: () => $ts('module.system.memberLevel.remark'),
      cell: ({ row }) => row.original.remark || '-'
    },
    {
      accessorKey: 'createdAt',
      header: () => $ts('module.system.memberLevel.createdAt')
    },
    ...(levelPermissions.canOperate.value ? [actionColumn] : [])
  ]
})

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysMemberLevel.remove.mutate(id)
  await onDeleted()
}

const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) {
    return
  }
  await $trpc.sysMemberLevel.batchDelete.mutate(checkedRowKeys.value)
  await onBatchDeleted()
}

onMounted(async () => {
  await search()
})
</script>
