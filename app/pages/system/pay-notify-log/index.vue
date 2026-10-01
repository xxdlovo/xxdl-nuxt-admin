<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysPayNotifyLogSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
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
            :delete-permission="logPermissions.codes.del"
            class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
            @delete="handleBatchDelete"
            @refresh="refresh"
          >
            <template #prefix>
              <span>{{ $ts('module.system.payNotifyLog.title') }}</span>
            </template>
          </TableHeaderOperation>
        </template>
      </TableWithPagination>
    </UCard>

    <SysPayNotifyLogDetail v-model:visible="detailVisible" :data="detailData ?? undefined" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '支付回调日志',
  icon: 'i-lucide-webhook'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysPayNotifyLogDto, SysPayNotifyLogQueryDTO } from '#shared/system/payNotifyLog'
import {
  businessDictCode,
  payChannelCodeRecord,
  payNotifyResultConfig,
  payNotifySourceRecord
} from '#shared/constants/business'
import { usePaginatedTable, useTableOperate, useBadgeColumn, useSelectionColumn } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'
import SysPayNotifyLogSearch from './components/sys-pay-notify-log-search.vue'
import SysPayNotifyLogDetail from './components/sys-pay-notify-log-detail.vue'
import { useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const logPermissions = useCrudPermissions('system:payNotifyLog')
const searchParams = ref<SysPayNotifyLogQueryDTO>({})
const noYesConfig = useDictBadgeConfig(businessDictCode.noYes)

const detailVisible = ref(false)
const detailData = ref<SysPayNotifyLogDto | null>(null)

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysPayNotifyLogDto>({
  query: params => $trpc.sysPayNotifyLog.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

const { checkedRowKeys, onBatchDeleted } = useTableOperate<SysPayNotifyLogDto>({
  data,
  idKey: 'id',
  refresh
})

const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysPayNotifyLogDto>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

const translate = (record: Record<string, string>, value?: string | null) => {
  if (!value) return '-'
  const key = record[value]
  return key ? $ts(key) : value
}

const handleDetail = (log: SysPayNotifyLogDto) => {
  detailData.value = log
  detailVisible.value = true
}

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysPayNotifyLog.remove.mutate(id)
  useToastSuccess($ts('common.deleteSuccess'))
  await refresh()
}

const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) {
    return
  }
  await $trpc.sysPayNotifyLog.batchDelete.mutate(checkedRowKeys.value)
  await onBatchDeleted()
}

const columns = computed<TableColumn<SysPayNotifyLogDto>[]>(() => {
  const actionColumn: TableColumn<SysPayNotifyLogDto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      actions.push(h(UButton, {
        variant: 'outline',
        color: 'primary',
        size: 'xs',
        onClick: () => handleDetail(row.original)
      }, { default: () => $ts('common.detail') }))

      if (logPermissions.canDel.value) {
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
    ...(logPermissions.canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => h('span', { class: 'text-muted' }, (pagination.page - 1) * pagination.pageSize + row.index + 1)
    },
    {
      accessorKey: 'createdAt',
      header: () => $ts('module.system.payNotifyLog.createdAt')
    },
    {
      accessorKey: 'channelCode',
      header: () => $ts('module.system.payNotifyLog.channelCode'),
      cell: ({ row }) => translate(payChannelCodeRecord, row.original.channelCode)
    },
    {
      accessorKey: 'outTradeNo',
      header: () => $ts('module.system.payNotifyLog.outTradeNo')
    },
    {
      accessorKey: 'source',
      header: () => $ts('module.system.payNotifyLog.sourceLabel'),
      cell: ({ row }) => translate(payNotifySourceRecord, row.original.source)
    },
    useBadgeColumn<SysPayNotifyLogDto>('signValid', 'module.system.payNotifyLog.signValid', noYesConfig.value, 1),
    useBadgeColumn<SysPayNotifyLogDto>('processResult', 'module.system.payNotifyLog.processResult', payNotifyResultConfig, 0),
    {
      id: 'amount',
      header: () => $ts('module.system.payNotifyLog.amount'),
      cell: ({ row }) => h('span', {}, `${row.original.amount ?? '-'} ${row.original.currency ?? ''}`)
    },
    {
      accessorKey: 'dedupKey',
      header: () => $ts('module.system.payNotifyLog.dedupKey'),
      cell: ({ row }) => h('span', { class: 'text-xs text-muted break-all' }, row.original.dedupKey ?? '-')
    },
    {
      accessorKey: 'clientIp',
      header: () => $ts('module.system.payNotifyLog.clientIp')
    },
    ...(logPermissions.canOperate.value ? [actionColumn] : [])
  ]
})

onMounted(async () => {
  await search()
})
</script>
