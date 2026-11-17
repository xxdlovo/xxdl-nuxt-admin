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
              :add-permission="permissions.codes.add"
              :delete-permission="permissions.codes.del"
              class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
          >
            <template #prefix>
              <span>{{ $ts('module.system.loginLog.title') }}</span>
            </template>
            <template #default>
              <UButton
                  v-if="permissions.canList.value"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-download"
                  @click="handleExport"
              >
                {{ $ts('module.system.excel.export') }}
              </UButton>
              <Popconfirm
                  v-if="permissions.canDel.value"
                  :content="$ts('module.system.loginLog.clearConfirm')"
                  :positive-text="$ts('common.confirm')"
                  @confirm="handleClear"
              >
                <template #trigger>
                  <UButton color="error" variant="outline" icon="i-lucide-trash-2">
                    {{ $ts('module.system.loginLog.clear') }}
                  </UButton>
                </template>
              </Popconfirm>
            </template>
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
import type { SysLoginLogDto, SysLoginLogQueryDTO } from '#admin/shared/system/loginLog'
import SysLoginLogSearch from './components/sys-login-log-search.vue'
import SysLoginLogDetail from './components/sys-login-log-detail.vue'
import { businessDictCode } from '#admin/shared/constants/business'
import { useBadgeColumn, usePaginatedTable, minWidthColumn, stableColumn, stickyRightColumn, tableColumnWidth, withColumnWidth } from '#admin/app/composables/useTable'
import { downloadExcel } from '#admin/app/utils/excel'
import { useToastSuccess } from '#admin/app/utils/toast'
import TableWithPagination from '#admin/app/components/table/TableWithPagination.vue'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const { hasPermission } = useRbacProfile()
const tableRef = useTemplateRef('table')
const permissions = useCrudPermissions('system:loginLog')
const searchParams = ref<SysLoginLogQueryDTO>({})
const detailVisible = ref(false)
const detailData = ref<SysLoginLogDto | null>(null)
const loginStatusConfig = useDictBadgeConfig(businessDictCode.jobLogStatus)

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

const handleExport = async () => {
  await downloadExcel('loginLog', { ...searchParams.value })
}

const handleClear = async () => {
  await $trpc.sysLoginLog.clear.mutate()
  useToastSuccess($ts('module.system.loginLog.clearSuccess'))
  await refresh()
}

const handleUnlock = async (row: SysLoginLogDto) => {
  await $trpc.sysLoginLog.unlock.mutate({
    userId: row.userId ?? undefined,
    username: row.userId ? undefined : row.username ?? undefined,
  })
  useToastSuccess($ts('module.system.loginLog.unlockSuccess'))
  await refresh()
}

const columns = computed<TableColumn<SysLoginLogDto>[]>(() => {
  const actionColumn: TableColumn<SysLoginLogDto> = {
    id: 'actions',
    ...stickyRightColumn(180),
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const actions = [
        h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          icon: 'i-lucide-eye',
          onClick: () => handleDetail(row.original)
        }, { default: () => $ts('common.detail') })
      ]

      if (row.original.status === 2 && hasPermission('system:user:unlock')) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'warning',
          size: 'xs',
          icon: 'i-lucide-lock-open',
          onClick: () => handleUnlock(row.original)
        }, { default: () => $ts('module.system.loginLog.unlock') }))
      }

      return h('div', { class: 'flex gap-2' }, actions)
    }
  }

  return [
    {
      id: 'index',
      ...stableColumn(tableColumnWidth.index),
      header: () => $ts('common.index'),
      cell: ({ row }) => {
        const index = (pagination.page - 1) * pagination.pageSize + row.index + 1
        return h('span', { class: 'text-gray-500 dark:text-gray-400' }, index)
      }
    },
    {
      accessorKey: 'username',
      ...minWidthColumn(140),
      header: () => $ts('module.system.loginLog.username'),
      cell: ({ row }) => h('span', { class: 'block truncate', title: row.original.username ?? '' }, row.original.username || '-')
    },
    {
      accessorKey: 'ip',
      ...stableColumn(140),
      header: () => $ts('module.system.loginLog.ip')
    },
    {
      accessorKey: 'location',
      ...minWidthColumn(140),
      header: () => $ts('module.system.loginLog.location'),
      cell: ({ row }) => h('span', { class: 'block truncate', title: row.original.location ?? '' }, row.original.location || '-')
    },
    {
      accessorKey: 'browser',
      ...minWidthColumn(120),
      header: () => $ts('module.system.loginLog.browser'),
      cell: ({ row }) => h('span', { class: 'block truncate', title: row.original.browser ?? '' }, row.original.browser || '-')
    },
    {
      accessorKey: 'os',
      ...minWidthColumn(120),
      header: () => $ts('module.system.loginLog.os'),
      cell: ({ row }) => h('span', { class: 'block truncate', title: row.original.os ?? '' }, row.original.os || '-')
    },
    {
      accessorKey: 'loginTime',
      ...stableColumn(tableColumnWidth.time),
      header: () => $ts('module.system.loginLog.loginTime')
    },
    withColumnWidth(useBadgeColumn<SysLoginLogDto>(
        'status',
        'module.system.loginLog.loginStatus',
        loginStatusConfig.value,
        1
    ), stableColumn(tableColumnWidth.status)),
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
