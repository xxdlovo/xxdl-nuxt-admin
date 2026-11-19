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
          compact-mobile
          :mobile-row-actions="rowActions"
      >
        <template #header>
          <TableHeaderOperation
              v-if="tableRef?.tableRef"
              @refresh="refresh"
              :tableRef="tableRef?.tableRef"
              :loading="loading"
              :add-permission="permissions.codes.add"
              :delete-permission="permissions.codes.del"
              compact-mobile
              class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
          >
            <template #prefix>
              <span class="hidden md:inline">{{ $ts('module.system.sysLog.title') }}</span>
            </template>
            <template #default>
              <UButton
                  v-if="permissions.canList.value"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-download"
                  :aria-label="$ts('module.system.excel.export')"
                  :title="$ts('module.system.excel.export')"
                  @click="handleExport"
              >
                <span class="hidden md:inline">{{ $ts('module.system.excel.export') }}</span>
              </UButton>
              <Popconfirm
                  v-if="permissions.canDel.value"
                  :content="$ts('module.system.sysLog.clearConfirm')"
                  :positive-text="$ts('common.confirm')"
                  @confirm="handleClear"
              >
                <template #trigger>
                  <UButton color="error" variant="outline" icon="i-lucide-trash-2" :aria-label="$ts('module.system.sysLog.clear')" :title="$ts('module.system.sysLog.clear')">
                    <span class="hidden md:inline">{{ $ts('module.system.sysLog.clear') }}</span>
                  </UButton>
                </template>
              </Popconfirm>
            </template>
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
import type { SysLogDto, SysLogQueryDTO } from '#admin/shared/system/SysLog'
import SysLogSearch from './components/sys-log-search.vue'
import SysLogDetail from './components/sys-log-detail.vue'
import { businessDictCode } from '#admin/shared/constants/business'
import { useBadgeColumn, usePaginatedTable, minWidthColumn, stableColumn, stickyRightColumn, tableColumnWidth, withColumnWidth } from '#admin/app/composables/useTable'
import type { MobileRowAction } from '#admin/app/composables/useTable'
import { downloadExcel } from '#admin/app/utils/excel'
import { useToastSuccess } from '#admin/app/utils/toast'
import TableWithPagination from '#admin/app/components/table/TableWithPagination.vue'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const permissions = useCrudPermissions('system:systemLog')
const searchParams = ref<SysLogQueryDTO>({})
const detailVisible = ref(false)
const detailData = ref<SysLogDto | null>(null)
const logLevelConfig = useDictBadgeConfig(businessDictCode.sysLogLevel)
const logStatusConfig = useDictBadgeConfig(businessDictCode.jobLogStatus)

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

/** 移动端行操作：点击「⋯」在按钮下方展示 */
const rowActions = (row: SysLogDto): MobileRowAction[] => [
  {
    label: $ts('common.detail'),
    icon: 'i-lucide-eye',
    color: 'primary',
    onSelect: () => handleDetail(row)
  }
]

const handleDetail = (row: SysLogDto) => {
  detailData.value = JSON.parse(JSON.stringify(row))
  detailVisible.value = true
}

const handleExport = async () => {
  await downloadExcel('systemLog', { ...searchParams.value })
}

const handleClear = async () => {
  await $trpc.systemLog.clear.mutate()
  useToastSuccess($ts('module.system.systemLog.clearSuccess'))
  await refresh()
}

const columns = computed<TableColumn<SysLogDto>[]>(() => {
  const actionColumn: TableColumn<SysLogDto> = {
    id: 'actions',
    ...stickyRightColumn(120),
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
      ...stableColumn(tableColumnWidth.index),
      header: () => $ts('common.index'),
      cell: ({ row }) => {
        const index = (pagination.page - 1) * pagination.pageSize + row.index + 1
        return h('span', { class: 'text-gray-500 dark:text-gray-400' }, index)
      }
    },
    withColumnWidth(useBadgeColumn<SysLogDto>(
        'level',
        'module.system.sysLog.logLevel',
        logLevelConfig.value,
        0
    ), stableColumn(tableColumnWidth.status)),
    {
      accessorKey: 'module',
      ...minWidthColumn(190),
      header: () => $ts('module.system.sysLog.logModule'),
      cell: ({ row }) => h('span', { class: 'block truncate font-mono text-xs', title: row.original.module ?? '' }, row.original.module || '-')
    },
    {
      accessorKey: 'message',
      ...minWidthColumn(320),
      header: () => $ts('module.system.sysLog.logMessage'),
      cell: ({ row }) => h('span', { class: 'block truncate text-xs', title: row.original.message ?? '' }, row.original.message || '-')
    },
    {
      accessorKey: 'username',
      ...minWidthColumn(100),
      header: () => $ts('module.system.sysLog.detail.operator'),
      cell: ({ row }) => h('span', { class: 'block truncate', title: row.original.username ?? '' }, row.original.username || '-')
    },
    {
      accessorKey: 'createdAt',
      ...stableColumn(tableColumnWidth.time),
      header: () => $ts('module.system.sysLog.detail.operationTime')
    },
    withColumnWidth(useBadgeColumn<SysLogDto>(
        'status',
        'module.system.sysLog.logStatus',
        logStatusConfig.value,
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
