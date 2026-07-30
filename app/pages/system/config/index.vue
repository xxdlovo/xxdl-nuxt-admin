<template>
  <div class="flex h-full flex-col gap-3 p-3">
    <div class="shrink-0">
      <SysConfigSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
    </div>

    <UCard class="flex min-h-0 flex-1 flex-col overflow-hidden" :ui="{ body: 'flex h-full flex-col p-0 sm:p-0' }">
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
            :table-ref="tableRef?.tableRef"
            :loading="loading"
            :disabled-delete="checkedRowKeys.length === 0 || loading"
            :selected-count="checkedRowKeys.length"
            :add-permission="configPermissions.codes.add"
            :delete-permission="configPermissions.codes.del"
            class="shrink-0 border-b border-gray-200 px-4 py-2 dark:border-gray-800"
            @add="handleAdd"
            @delete="handleBatchDelete"
            @refresh="refresh"
          >
            <template #prefix>
              <span>{{ $ts('module.system.config.title') }}</span>
            </template>
          </TableHeaderOperation>

          <SysConfigOperate
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
import type { SysConfigDto, SysConfigQueryDTO } from '#shared/system/config'
import { businessDictCode } from '#shared/constants/business'
import TableWithPagination from '~/components/table/TableWithPagination.vue'
import { useBadgeColumn, usePaginatedTable, useSelectionColumn, useTableOperate } from '~/composables/useTable'
import SysConfigOperate from './components/sys-config-operate.vue'
import SysConfigSearch from './components/sys-config-search.vue'

definePageMeta({
  layout: 'system',
  title: '参数配置',
  icon: 'i-lucide-sliders-horizontal'
})

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const configPermissions = useCrudPermissions('system:config')
const enableStatusConfig = useDictBadgeConfig(businessDictCode.enableStatus)
const searchParams = ref<SysConfigQueryDTO>({})
const configTypeConfig = computed(() => ({
  '1': { i18nKey: 'module.system.config.type.system', color: 'primary' as const },
  '2': { i18nKey: 'module.system.config.type.custom', color: 'success' as const }
}))
const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysConfigDto>({
  query: params => $trpc.sysConfig.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
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
  closeVisible
} = useTableOperate<SysConfigDto>({
  data,
  idKey: 'id',
  refresh
})

const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysConfigDto>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

const columns = computed<TableColumn<SysConfigDto>[]>(() => {
  const actionColumn: TableColumn<SysConfigDto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      if (configPermissions.canEdit.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          icon: 'i-ic-round-edit',
          onClick: () => handleEdit(row.original.id as string)
        }, { default: () => $ts('common.edit') }))
      }

      if (configPermissions.canDel.value) {
        actions.push(h(Popconfirm, {
          onConfirm: () => handleDelete(row.original.id as string)
        }, {
          trigger: () => h(UButton, {
            variant: 'outline',
            color: 'error',
            size: 'xs',
            icon: 'i-ic-round-delete'
          }, { default: () => $ts('common.delete') })
        }))
      }

      return h('div', { class: 'flex gap-2' }, actions)
    }
  }

  return [
    ...(configPermissions.canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => h('span', { class: 'text-gray-500 dark:text-gray-400' }, (pagination.page - 1) * pagination.pageSize + row.index + 1)
    },
    {
      accessorKey: 'configName',
      header: () => $ts('module.system.config.configName')
    },
    {
      accessorKey: 'configKey',
      header: () => $ts('module.system.config.configKey')
    },
    {
      accessorKey: 'configValue',
      header: () => $ts('module.system.config.configValue')
    },
    useBadgeColumn<SysConfigDto>(
      'configType',
      'module.system.config.configType',
      configTypeConfig.value,
      1
    ),
    useBadgeColumn<SysConfigDto>(
      'status',
      'module.system.config.status',
      enableStatusConfig.value,
      1
    ),
    ...(configPermissions.canOperate.value ? [actionColumn] : [])
  ]
})

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysConfig.remove.mutate(id)
  await onDeleted()
}

const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) return
  await $trpc.sysConfig.batchDelete.mutate(checkedRowKeys.value)
  await onBatchDeleted()
}

onMounted(async () => {
  await search()
})
</script>

<style scoped>
@media (max-width: 640px) {
  :deep(table) {
    display: table;
    min-width: 860px;
    width: 100%;
  }
}
</style>
