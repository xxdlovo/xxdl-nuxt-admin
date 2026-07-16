<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <!-- 搜索表单 -->
    <div class="flex-shrink-0">
      <SysLogSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)"/>
    </div>

    <!-- 表格卡片 -->
    <UCard class="flex-1 min-h-0 flex flex-col overflow-hidden" :ui="{body: 'flex flex-col h-full p-0 sm:p-0' }">
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
              @add="handleAdd"
              @delete="handleBatchDelete"
              @refresh="refresh"
              :tableRef="tableRef?.tableRef"
              :loading="loading"
              :disabledDelete="checkedRowKeys.length === 0 || loading"
              :selectedCount="checkedRowKeys.length"
              class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
          >
          <template #prefix>
            <span>{{ $ts('module.system.sysLog.title') }}</span>
          </template>
        </TableHeaderOperation>

          <!-- 操作弹窗 -->
          <SysLogOperate
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
definePageMeta({
  layout: 'system'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysLogDto, SysLogQueryDTO } from '#shared/system/SysLog'
import SysLogSearch from './components/sys-log-search.vue'
import SysLogOperate from "./components/sys-log-operate.vue"

import { SYS_LOG_LEVEL_CONFIG, LOGIN_STATUS_CONFIG } from "#shared/constants/business"
import { usePaginatedTable, useTableOperate, useBadgeColumn, useSelectionColumn } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')

// 搜索参数
const searchParams = ref<SysLogQueryDTO>({})

// 表格 hook
const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysLogDto>({
  query: (params) => $trpc.systemLog.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

// 表格操作 hook
const { operateType, editingData, drawerVisible, checkedRowKeys, handleAdd, handleEdit, onDeleted, onBatchDeleted, closeVisible } = useTableOperate<SysLogDto>({
  data,
  idKey: 'id',
  refresh
})

// 选择列
const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysLogDto>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

// 定义列配置
const columns = computed<TableColumn<SysLogDto>[]>(() => {
  return [
    selectionColumn,
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => {
        const index = (pagination.page - 1) * pagination.pageSize + row.index + 1
        return h('span', { class: 'text-gray-500 dark:text-gray-400' }, index)
      }
    },
    useBadgeColumn<SysLogDto>(
      'level',
      'module.system.sysLog.logLevel',
      SYS_LOG_LEVEL_CONFIG,
      0
    ),
    {
      accessorKey: 'module',
      header: () => $ts('module.system.sysLog.logModule')
    },
    {
      accessorKey: 'message',
      header: () => $ts('module.system.sysLog.logMessage')
    },
    useBadgeColumn<SysLogDto>(
      'status',
      'module.system.sysLog.logStatus',
        LOGIN_STATUS_CONFIG,
      1
    ),
    {
      id: 'actions',
      header: () => $ts('common.operate'),
      cell: ({ row }) => {
        const UButton = resolveComponent('UButton')
        const Popconfirm = resolveComponent('Popconfirm')

        return h('div', { class: 'flex gap-2' }, [
          h(UButton, {
            variant: 'outline',
            color: 'primary',
            size: 'xs',
            onClick: () => handleEdit(row.original.id as string)
          }, { default: () => $ts('common.edit') }),

          h(Popconfirm, {
            onConfirm: () => handleDelete(row.original.id as string)
          }, {
            trigger: () => h(UButton, {
              variant: 'outline',
              color: 'error',
              size: 'xs'
            }, { default: () => $ts('common.delete') })
          })
        ])
      }
    }
  ]
})

/**
 * 处理删除
 */
const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.systemLog.remove.mutate(id)
  await onDeleted()
}

/**
 * 处理批量删除
 */
const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) {
    return
  }
  await $trpc.systemLog.batchDelete.mutate(checkedRowKeys.value)
  await onBatchDeleted()
}

// 初始化加载
onMounted(async () => {
  await search()
})
</script>

<style scoped>
:deep(.overflow-auto) {
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 640px) {
  :deep(table) {
    display: table;
    width: 100%;
    min-width: 600px;
  }
}
</style>
