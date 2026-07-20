<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysLogSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
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
            @refresh="refresh"
            :tableRef="tableRef?.tableRef"
            :loading="loading"
            class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
          >
            <template #prefix>
              <span>{{ $ts('module.system.sysLog.title') }}</span>
            </template>
            <template #default />
          </TableHeaderOperation>

          <SysLogDetail v-model:visible="detailVisible" :data="detailData" />
        </template>
      </TableWithPagination>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '系统日志',
  icon: 'i-lucide-file-text'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysLogDto, SysLogQueryDTO } from '#shared/system/SysLog'
import SysLogSearch from './components/sys-log-search.vue'
import SysLogDetail from './components/sys-log-detail.vue'
import { SUCCESS_FAILURE_CONFIG, SYS_LOG_LEVEL_CONFIG } from '#shared/constants/business'
import { useBadgeColumn, usePaginatedTable } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')

const searchParams = ref<SysLogQueryDTO>({})
const detailVisible = ref(false)
const detailData = ref<SysLogDto | null>(null)

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysLogDto>({
  query: params => $trpc.systemLog.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

const handleDetail = (row: SysLogDto) => {
  detailData.value = JSON.parse(JSON.stringify(row))
  detailVisible.value = true
}

const columns = computed<TableColumn<SysLogDto>[]>(() => {
  const actionColumn: TableColumn<SysLogDto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')

      return h(UButton, {
        variant: 'outline',
        color: 'primary',
        size: 'xs',
        icon: 'i-lucide-eye',
        onClick: () => handleDetail(row.original)
      }, { default: () => $ts('common.detail') })
    }
  }

  return [
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
    {
      accessorKey: 'username',
      header: () => $ts('module.system.sysLog.detail.operator')
    },
    {
      accessorKey: 'createdAt',
      header: () => $ts('module.system.sysLog.detail.operationTime')
    },
    useBadgeColumn<SysLogDto>(
      'status',
      'module.system.sysLog.logStatus',
      SUCCESS_FAILURE_CONFIG,
      1
    ),
    actionColumn
  ]
})

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
    min-width: 760px;
  }
}
</style>
