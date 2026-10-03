<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysOrderSearch v-model:model="searchParams" @search="handleSearch" />
    </div>

    <!-- 区间汇总：成交口径只统计已完成订单，待支付 / 待交付为全量口径（不随区间变化） -->
    <div class="flex-shrink-0 grid grid-cols-2 md:grid-cols-4 gap-3">
      <UCard :ui="{ body: 'p-3' }">
        <div class="text-xs text-muted">{{ $ts('module.system.order.todayCount') }}</div>
        <div class="mt-1 text-lg font-semibold">{{ summary.todayCount }}</div>
      </UCard>
      <UCard :ui="{ body: 'p-3' }">
        <div class="text-xs text-muted">{{ $ts('module.system.order.todayAmount') }}</div>
        <div class="mt-1 text-lg font-semibold">¥{{ summary.todayAmount }}</div>
      </UCard>
      <UCard :ui="{ body: 'p-3' }">
        <div class="text-xs text-muted">{{ $ts('module.system.order.pendingCount') }}</div>
        <div class="mt-1 text-lg font-semibold">{{ summary.pendingCount }}</div>
      </UCard>
      <UCard :ui="{ body: 'p-3' }">
        <div class="text-xs text-muted">{{ $ts('module.system.order.pendingFulfillCount') }}</div>
        <div class="mt-1 text-lg font-semibold">{{ summary.pendingFulfillCount }}</div>
      </UCard>
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
            :batch-delete-loading="batchDeleting"
            :selected-count="checkedRowKeys.length"
            class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
            @refresh="refresh"
          >
            <template #prefix>
              <span>{{ $ts('module.system.order.title') }}</span>
            </template>
            <!-- 默认插槽只保留批量删除（显式授权 + 有选中才显示）：订单由会员下单产生，不提供新增 -->
            <template #default>
              <UButton
                v-if="canDel && checkedRowKeys.length > 0"
                size="xs"
                variant="outline"
                color="error"
                icon="i-lucide-trash-2"
                :loading="batchDeleting"
                @click="batchDeleteVisible = true"
              >
                {{ $ts('common.batchDelete') }}
              </UButton>
            </template>
          </TableHeaderOperation>
        </template>
      </TableWithPagination>
    </UCard>

    <SysOrderDetail v-model:visible="detailVisible" :data="detailTarget ?? undefined" />

    <SysOrderClose v-model:visible="closeVisible" :data="closeTarget" :refresh="refreshAll" />

    <SysOrderFulfill v-model:visible="fulfillVisible" :data="fulfillTarget" :refresh="refreshAll" />

    <!-- 批量删除：选中的每一单都要满足「已关闭 / 发起失败」才会被执行 -->
    <UModal
      v-model:open="batchDeleteVisible"
      :title="$ts('common.batchDelete')"
      :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[480px]', footer: 'justify-end gap-2' }"
    >
      <template #body>
        <p class="text-sm">
          {{ $ts('common.confirmDelete', { count: checkedRowKeys.length }) }}
        </p>
      </template>
      <template #footer>
        <UButton color="neutral" variant="subtle" :disabled="batchDeleting" @click="batchDeleteVisible = false">
          {{ $ts('common.cancel') }}
        </UButton>
        <UButton color="error" :loading="batchDeleting" @click="handleBatchDelete">
          {{ $ts('common.confirm') }}
        </UButton>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '订单管理',
  icon: 'i-lucide-shopping-bag'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { Component } from 'vue'
import type { SysOrderRespDTO, SysOrderQueryDTO } from '#shared/system/order'
import {
  goodsTypeRecord,
  orderFulfillStatusConfig,
  orderPayModeRecord,
  orderPriceSourceRecord,
  orderStatusConfig
} from '#shared/constants/business'
import { customPermissionCode } from '#shared/auth'
import { badgeColorClasses } from '~/composables/badgeColorClasses'
import { useBadgeColumn, usePaginatedTable, useSelectionColumn, useTableOperate } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'
import { useToastError, useToastSuccess, useToastWarning } from '~/utils/toast'
import SysOrderSearch from './components/sys-order-search.vue'
import SysOrderDetail from './components/sys-order-detail.vue'
import SysOrderClose from './components/sys-order-close.vue'
import SysOrderFulfill from './components/sys-order-fulfill.vue'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const orderPermissions = useCrudPermissions('system:order')
const { isAdmin, hasPermission } = useRbacProfile()

// confirm / close / sync / fulfill 是一组会推进订单状态、牵动资金的动作，各自单独授权
const canConfirm = computed(() => isAdmin.value || hasPermission(customPermissionCode('system:order', 'confirm')))
const canClose = computed(() => isAdmin.value || hasPermission(customPermissionCode('system:order', 'close')))
const canSync = computed(() => isAdmin.value || hasPermission(customPermissionCode('system:order', 'sync')))
const canFulfill = computed(() => isAdmin.value || hasPermission(customPermissionCode('system:order', 'fulfill')))

// 模板里只读权限判断统一用顶层计算属性，避免嵌套 ref 在模板中的解包歧义
const canDel = computed(() => orderPermissions.canDel.value)
const canOperate = computed(() => orderPermissions.canOperate.value)

const searchParams = ref<SysOrderQueryDTO>({})

const detailVisible = ref(false)
const detailTarget = ref<SysOrderRespDTO | null>(null)

const closeVisible = ref(false)
const closeTarget = ref<SysOrderRespDTO | null>(null)

const fulfillVisible = ref(false)
const fulfillTarget = ref<SysOrderRespDTO | null>(null)

const batchDeleteVisible = ref(false)
const batchDeleting = ref(false)

/** 单行动作的 loading 行标识：避免同一行被连点两次 */
const actingId = ref<string>('')

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh
} = usePaginatedTable<SysOrderRespDTO>({
  query: params => $trpc.sysOrder.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

const { checkedRowKeys } = useTableOperate<SysOrderRespDTO>({
  data,
  idKey: 'id',
  refresh
})

const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysOrderRespDTO>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

const summary = ref({
  todayCount: 0,
  todayAmount: '0.00',
  pendingCount: 0,
  pendingFulfillCount: 0
})

const recordLabel = (record: Record<string, string>, value?: string | null) => {
  if (!value) return '-'
  const key = record[value]

  return key ? $ts(key) : value
}

/** 徽标配置（i18nKey + color）→ 文案，用于提示语里引用状态名 */
const badgeLabel = (config: Readonly<Record<string, { i18nKey: string }>>, value?: string | null) => {
  const item = value ? config[value] : undefined

  return item ? $ts(item.i18nKey) : (value ?? '-')
}

const amountText = (value?: string | number | null) => (value == null || value === '' ? '-' : `¥${value}`)

/** 汇总卡片跟随搜索区间刷新（待支付 / 待交付为全量口径） */
const loadSummary = async () => {
  const result = await $trpc.sysOrder.summary.query({
    createdFrom: searchParams.value.createdFrom ?? null,
    createdTo: searchParams.value.createdTo ?? null
  })

  summary.value = {
    todayCount: result.todayCount,
    todayAmount: result.todayAmount,
    pendingCount: result.pendingCount,
    pendingFulfillCount: result.pendingFulfillCount
  }
}

const handleSearch = async (params: SysOrderQueryDTO) => {
  // 回到第 1 页再查，避免在第 3 页搜出 1 条数据时出现空列表
  pagination.page = 1
  // 列表与汇总卡片同时刷新：卡片必须跟随搜索区间
  await Promise.all([search(params), loadSummary()])
}

/** 关闭 / 交付会改变待支付、待交付口径，必须连同汇总卡片一起刷新 */
const refreshAll = async () => {
  await Promise.all([refresh(), loadSummary()])
}

const handleDetail = (row: SysOrderRespDTO) => {
  detailTarget.value = row
  detailVisible.value = true
}

const handleOpenClose = (row: SysOrderRespDTO) => {
  closeTarget.value = row
  closeVisible.value = true
}

const handleOpenFulfill = (row: SysOrderRespDTO) => {
  fulfillTarget.value = row
  fulfillVisible.value = true
}

const handleConfirm = async (row: SysOrderRespDTO) => {
  if (!row.id || loading.value || actingId.value) return

  actingId.value = row.id

  try {
    await $trpc.sysOrder.confirm.mutate({ id: row.id })
    useToastSuccess($ts('module.system.order.confirmSuccess'))
    await refreshAll()
  } finally {
    actingId.value = ''
  }
}

/** 同步支付状态：向渠道查询，返回是否推进了订单 */
const handleSync = async (row: SysOrderRespDTO) => {
  if (!row.id || loading.value || actingId.value) return

  actingId.value = row.id

  try {
    const result = await $trpc.sysOrder.sync.mutate({ id: row.id })

    if (result.changed) {
      useToastSuccess($ts('module.system.order.syncSuccess'), undefined, $ts('module.system.order.syncChanged', { status: badgeLabel(orderStatusConfig, result.status) }))
      await refreshAll()
    } else {
      useToastWarning($ts('module.system.order.syncUnchanged'), undefined, $ts('module.system.order.syncUnchangedDesc', { payOrderStatus: result.payOrderStatus ?? '-' }))
    }
  } finally {
    actingId.value = ''
  }
}

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysOrder.remove.mutate(id)
  useToastSuccess($ts('common.deleteSuccess'))
  await refreshAll()
}

/** 批量删除：先剔除不满足删除条件的单（仅已关闭 / 发起失败可删） */
const handleBatchDelete = async () => {
  if (loading.value || batchDeleting.value || checkedRowKeys.value.length === 0) return

  const rows = data.value.filter(item => checkedRowKeys.value.includes(item.id as string))
  const removable = rows.filter(item => item.status === 'CL' || item.status === 'FL')
  const skipped = rows.length - removable.length

  if (removable.length === 0) {
    batchDeleteVisible.value = false
    useToastError($ts('module.system.order.batchDeleteNone'))

    return
  }

  batchDeleting.value = true

  try {
    await $trpc.sysOrder.batchDelete.mutate(removable.map(item => item.id as string))

    if (skipped > 0) {
      useToastWarning($ts('module.system.order.batchDeletePartial', { count: skipped }))
    } else {
      useToastSuccess($ts('common.deleteSuccess'))
    }

    checkedRowKeys.value = []
    batchDeleteVisible.value = false
    await refreshAll()
  } finally {
    batchDeleting.value = false
  }
}

const columns = computed<TableColumn<SysOrderRespDTO>[]>(() => {
  const actionColumn: TableColumn<SysOrderRespDTO> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []
      const item = row.original
      const busy = actingId.value === item.id

      actions.push(h(UButton, {
        variant: 'outline',
        color: 'primary',
        size: 'xs',
        onClick: () => handleDetail(item)
      }, { default: () => $ts('common.detail') }))

      // 余额单：后台确认实扣（确认冻结 + 核销券 + 加销量）
      if (canConfirm.value && item.status === 'WP' && item.payMode === 'balance') {
        actions.push(h(Popconfirm, {
          content: $ts('module.system.order.confirmConfirm'),
          positiveText: $ts('module.system.order.confirm'),
          loading: busy,
          onConfirm: () => handleConfirm(item)
        }, {
          trigger: () => h(UButton, {
            variant: 'outline',
            color: 'success',
            size: 'xs',
            disabled: busy
          }, { default: () => $ts('module.system.order.confirm') })
        }))
      }

      // 在线单：查看支付码 / 主动向渠道同步
      if (canSync.value && item.status === 'WP' && item.payMode === 'online') {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'info',
          size: 'xs',
          disabled: busy,
          onClick: () => handleSync(item)
        }, { default: () => $ts('module.system.order.viewPayCode') }))
      }

      // 服务类订单已支付且待交付
      if (canFulfill.value && item.status === 'OD' && item.fulfillStatus === 'pending') {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          onClick: () => handleOpenFulfill(item)
        }, { default: () => $ts('module.system.order.fulfill') }))
      }

      if (canClose.value && item.status === 'WP') {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'warning',
          size: 'xs',
          onClick: () => handleOpenClose(item)
        }, { default: () => $ts('module.system.order.close') }))
      }

      if (canDel.value && (item.status === 'CL' || item.status === 'FL')) {
        actions.push(h(Popconfirm, {
          content: $ts('common.confirmDelete', { count: 1 }),
          positiveText: $ts('common.delete'),
          onConfirm: () => handleDelete(item.id as string)
        }, {
          trigger: () => h(UButton, {
            variant: 'outline',
            color: 'error',
            size: 'xs'
          }, { default: () => $ts('common.delete') })
        }))
      }

      return h('div', { class: 'flex flex-wrap gap-2' }, actions)
    }
  }

  return [
    ...(canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => h('span', { class: 'text-muted' }, (pagination.page - 1) * pagination.pageSize + row.index + 1)
    },
    {
      accessorKey: 'orderNo',
      header: () => $ts('module.system.order.orderNo'),
      cell: ({ row }) => h('span', { class: 'font-medium break-all' }, row.original.orderNo || '-')
    },
    {
      id: 'member',
      header: () => $ts('module.system.order.member'),
      cell: ({ row }) => h('div', { class: 'flex flex-col' }, [
        h('span', { class: 'break-all' }, row.original.nickname || row.original.username || '-'),
        h('span', { class: 'text-xs text-muted' }, row.original.phone || '-')
      ])
    },
    {
      id: 'goods',
      header: () => $ts('module.system.order.goods'),
      cell: ({ row }) => h('div', { class: 'flex flex-wrap items-center gap-2' }, [
        h('span', { class: 'break-all' }, row.original.goodsName || '-'),
        h('span', {
          class: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${badgeColorClasses.neutral}`
        }, recordLabel(goodsTypeRecord, row.original.goodsType))
      ])
    },
    {
      id: 'amount',
      header: () => $ts('module.system.order.payAmount'),
      cell: ({ row }) => h('div', { class: 'flex flex-col' }, [
        h('span', { class: 'font-medium' }, amountText(row.original.payAmount)),
        h('span', { class: 'text-xs text-muted' }, `${amountText(row.original.unitPrice)} × ${row.original.quantity ?? '-'}`)
      ])
    },
    {
      id: 'priceSource',
      header: () => $ts('module.system.order.priceSourceLabel'),
      cell: ({ row }) => {
        // 等级价是权益兑现的关键信号，用成功色徽标高亮
        const highlight = row.original.priceSource === 'level'
        const cls = badgeColorClasses[highlight ? 'success' : 'neutral'] || badgeColorClasses.neutral

        return h('span', {
          class: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`
        }, recordLabel(orderPriceSourceRecord, row.original.priceSource))
      }
    },
    {
      accessorKey: 'payMode',
      header: () => $ts('module.system.order.payModeLabel'),
      cell: ({ row }) => recordLabel(orderPayModeRecord, row.original.payMode)
    },
    useBadgeColumn<SysOrderRespDTO>('status', 'module.system.order.statusLabel', orderStatusConfig, 0),
    {
      id: 'fulfillStatus',
      header: () => $ts('module.system.order.fulfillStatusLabel'),
      cell: ({ row }) => {
        // 履约只对服务类订单有意义，其它类型不占位
        if (row.original.goodsType !== 'service') {
          return h('span', { class: 'text-muted' }, '-')
        }

        const config = row.original.fulfillStatus ? orderFulfillStatusConfig[row.original.fulfillStatus] : undefined

        if (!config) {
          return h('span', { class: 'text-muted' }, '-')
        }

        const cls = badgeColorClasses[config.color] || badgeColorClasses.neutral

        return h('span', {
          class: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`
        }, $ts(config.i18nKey))
      }
    },
    {
      accessorKey: 'createdAt',
      header: () => $ts('module.system.order.createdAt')
    },
    ...(canOperate.value || canConfirm.value || canClose.value || canSync.value || canFulfill.value
      ? [actionColumn]
      : [])
  ]
})

onMounted(async () => {
  await Promise.all([search(), loadSummary()])
})
</script>
