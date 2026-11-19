<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysPayOrderSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
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
            :table-ref="tableRef.tableRef"
            :loading="loading"
            :add-permission="orderPermissions.codes.add"
            compact-mobile
            class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
            @refresh="refresh"
          >
            <template #prefix>
              <span class="hidden md:inline">{{ $ts('module.system.payOrder.title') }}</span>
            </template>
            <!-- 空默认插槽：支付记录由支付链路写入，不展示新增/批量删除（同 sys-log 的处理方式） -->
            <template #default />
          </TableHeaderOperation>
        </template>
      </TableWithPagination>
    </UCard>

    <SysPayOrderDetail v-model:visible="detailVisible" :data="detailData ?? undefined" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '支付记录',
  icon: 'i-lucide-receipt-text'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysPayOrderDto, SysPayOrderQueryDTO } from '#trade/shared/system/payOrder'
import { payChannelCodeRecord, payOrderStatusConfig } from '#admin/shared/constants/business'
import { usePaginatedTable, useBadgeColumn, minWidthColumn, stableColumn, stickyRightColumn, tableColumnWidth, withColumnWidth } from '#admin/app/composables/useTable'
import type { MobileRowAction } from '#admin/app/composables/useTable'
import TableWithPagination from '#admin/app/components/table/TableWithPagination.vue'
import SysPayOrderSearch from './components/sys-pay-order-search.vue'
import SysPayOrderDetail from './components/sys-pay-order-detail.vue'
import { useToastSuccess } from '#admin/app/utils/toast'

const $trpc = useTradeTrpc()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const orderPermissions = useCrudPermissions('system:payOrder')
const { isAdmin, hasPermission } = useRbacProfile()
const searchParams = ref<SysPayOrderQueryDTO>({})

// 主动查询会推进本地状态，属于额外授权的写操作
const canQuery = computed(() => isAdmin.value || hasPermission('system:payOrder:query'))

const detailVisible = ref(false)
const detailData = ref<SysPayOrderDto | null>(null)

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysPayOrderDto>({
  query: params => $trpc.sysPayOrder.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

const channelLabel = (code?: string | null) => {
  if (!code) return ''
  const key = payChannelCodeRecord[code]
  return key ? $ts(key) : code
}

const handleDetail = (order: SysPayOrderDto) => {
  detailData.value = order
  detailVisible.value = true
}

const handleSync = async (order: SysPayOrderDto) => {
  if (!order.id || loading.value) return

  const updated = await $trpc.sysPayOrder.syncStatus.mutate(order.id)
  useToastSuccess($ts('module.system.payOrder.syncSuccess'), undefined, statusLabel(updated.status))
  await refresh()
}

const handleClose = async (order: SysPayOrderDto) => {
  if (!order.id || loading.value) return

  await $trpc.sysPayOrder.close.mutate(order.id)
  useToastSuccess($ts('module.system.payOrder.closeSuccess'))
  await refresh()
}

/** 移动端行操作：点击「⋯」在按钮下方展示 */
const rowActions = (row: SysPayOrderDto): MobileRowAction[] => {
  const items: MobileRowAction[] = [
    {
      label: $ts('common.detail'),
      icon: 'i-lucide-eye',
      color: 'primary',
      onSelect: () => handleDetail(row)
    }
  ]

  if (canQuery.value) {
    items.push({
      label: $ts('module.system.payOrder.syncStatus'),
      icon: 'i-lucide-refresh-cw',
      onSelect: () => handleSync(row)
    })
  }

  if (orderPermissions.canEdit.value && row.status === 'WP') {
    items.push({
      label: $ts('module.system.payOrder.close'),
      icon: 'i-lucide-x-circle',
      color: 'warning',
      onSelect: () => handleClose(row)
    })
  }

  if (orderPermissions.canDel.value) {
    items.push({
      label: $ts('common.delete'),
      icon: 'i-lucide-trash-2',
      color: 'error',
      confirm: $ts('common.confirmDelete', { count: 1 }),
      onSelect: () => handleDelete(row.id as string)
    })
  }

  return items
}

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysPayOrder.remove.mutate(id)
  useToastSuccess($ts('common.deleteSuccess'))
  await refresh()
}

/** 统一状态 → 本地化文案（复用徽标配置，避免出现拼不出来的动态 key） */
const statusLabel = (status?: string | null) => {
  const item = status ? payOrderStatusConfig[status] : undefined
  return item ? $ts(item.i18nKey) : (status || '-')
}

const columns = computed<TableColumn<SysPayOrderDto>[]>(() => {
  const actionColumn: TableColumn<SysPayOrderDto> = {
    id: 'actions',
    ...stickyRightColumn(300),
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

      if (canQuery.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'neutral',
          size: 'xs',
          onClick: () => handleSync(row.original)
        }, { default: () => $ts('module.system.payOrder.syncStatus') }))
      }

      if (orderPermissions.canEdit.value && row.original.status === 'WP') {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'warning',
          size: 'xs',
          onClick: () => handleClose(row.original)
        }, { default: () => $ts('module.system.payOrder.close') }))
      }

      if (orderPermissions.canDel.value) {
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
    {
      id: 'index',
      ...stableColumn(tableColumnWidth.index),
      header: () => $ts('common.index'),
      cell: ({ row }) => h('span', { class: 'text-muted' }, (pagination.page - 1) * pagination.pageSize + row.index + 1)
    },
    {
      accessorKey: 'outTradeNo',
      ...minWidthColumn(220),
      header: () => $ts('module.system.payOrder.outTradeNo'),
      cell: ({ row }) => h('span', { class: 'block truncate font-mono text-xs', title: row.original.outTradeNo ?? '' }, row.original.outTradeNo || '-')
    },
    {
      accessorKey: 'channelCode',
      ...minWidthColumn(120),
      header: () => $ts('module.system.payOrder.channelCode'),
      cell: ({ row }) => h('span', { class: 'block truncate', title: channelLabel(row.original.channelCode) }, channelLabel(row.original.channelCode) || '-')
    },
    {
      id: 'amount',
      ...stableColumn(tableColumnWidth.amount),
      header: () => $ts('module.system.payOrder.amount'),
      cell: ({ row }) => h('span', {}, `${row.original.amount ?? ''} ${row.original.currency ?? ''}`)
    },
    withColumnWidth(useBadgeColumn<SysPayOrderDto>('status', 'module.system.payOrder.statusLabel', payOrderStatusConfig, 0), stableColumn(tableColumnWidth.status)),
    {
      accessorKey: 'providerOrderId',
      ...minWidthColumn(190),
      header: () => $ts('module.system.payOrder.providerOrderId'),
      cell: ({ row }) => h('span', { class: 'block truncate font-mono text-xs', title: row.original.providerOrderId ?? '' }, row.original.providerOrderId || '-')
    },
    {
      accessorKey: 'transactionId',
      ...minWidthColumn(240),
      header: () => $ts('module.system.payOrder.transactionId'),
      cell: ({ row }) => h('span', { class: 'block truncate font-mono text-xs', title: row.original.transactionId ?? '' }, row.original.transactionId || '-')
    },
    {
      accessorKey: 'paidAt',
      ...stableColumn(tableColumnWidth.time),
      header: () => $ts('module.system.payOrder.paidAt')
    },
    {
      accessorKey: 'createdAt',
      ...stableColumn(tableColumnWidth.time),
      header: () => $ts('module.system.payOrder.createdAt')
    },
    ...(orderPermissions.canOperate.value || canQuery.value ? [actionColumn] : [])
  ]
})

onMounted(async () => {
  await search()
})
</script>
