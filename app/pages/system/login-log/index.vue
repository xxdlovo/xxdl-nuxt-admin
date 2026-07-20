<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysLoginLogSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
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
              <span>{{ $ts('module.system.loginLog.title') }}</span>
            </template>
            <template #default />
          </TableHeaderOperation>

          <SysLoginLogDetail v-model:visible="detailVisible" :data="detailData" />
        </template>
      </TableWithPagination>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '登录日志',
  icon: 'i-lucide-log-in'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysLoginLogDto, SysLoginLogQueryDTO } from '#shared/system/loginLog'
import SysLoginLogSearch from './components/sys-login-log-search.vue'
import SysLoginLogDetail from './components/sys-login-log-detail.vue'
import { SUCCESS_FAILURE_CONFIG } from '#shared/constants/business'
import { useBadgeColumn, usePaginatedTable } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')

const searchParams = ref<SysLoginLogQueryDTO>({})
const detailVisible = ref(false)
const detailData = ref<SysLoginLogDto | null>(null)

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysLoginLogDto>({
  query: params => $trpc.sysLoginLog.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

const handleDetail = (row: SysLoginLogDto) => {
  detailData.value = JSON.parse(JSON.stringify(row))
  detailVisible.value = true
}

const columns = computed<TableColumn<SysLoginLogDto>[]>(() => {
  const actionColumn: TableColumn<SysLoginLogDto> = {
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
    {
      accessorKey: 'username',
      header: () => $ts('module.system.loginLog.username')
    },
    {
      accessorKey: 'ip',
      header: () => $ts('module.system.loginLog.ip')
    },
    {
      accessorKey: 'location',
      header: () => $ts('module.system.loginLog.location')
    },
    {
      accessorKey: 'browser',
      header: () => $ts('module.system.loginLog.browser')
    },
    {
      accessorKey: 'os',
      header: () => $ts('module.system.loginLog.os')
    },
    {
      accessorKey: 'loginTime',
      header: () => $ts('module.system.loginLog.loginTime')
    },
    useBadgeColumn<SysLoginLogDto>(
      'status',
      'module.system.loginLog.loginStatus',
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
