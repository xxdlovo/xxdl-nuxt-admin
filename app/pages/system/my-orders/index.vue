<template>
  <div class="h-full p-3 space-y-3">
    <!-- 筛选与动作 -->
    <UCard :ui="{ body: 'p-3' }">
      <div class="flex flex-wrap items-end gap-3">
        <USelect v-model.nullable="status" :items="statusItems" :placeholder="$ts('module.system.myOrder.status')" class="w-40" clearable />
        <UButton icon="tabler:search" variant="outline" @click="loadOrders(1)">
          {{ $ts('common.search') }}
        </UButton>
        <UButton icon="tabler:reload" variant="outline" color="neutral" @click="loadOrders(page)">
          {{ $ts('common.refresh') }}
        </UButton>
        <div class="flex-1" />
        <UButton to="/system/mall" icon="i-lucide-store" variant="outline" color="neutral">
          {{ $ts('module.system.mall.title') }}
        </UButton>
        <UButton to="/system/wallet" icon="i-lucide-wallet" variant="outline" color="neutral">
          {{ $ts('module.system.wallet.title') }}
        </UButton>
      </div>
    </UCard>

    <UCard class="flex-1 min-h-0 flex flex-col overflow-hidden" :ui="{ body: 'p-0 sm:p-0' }">
      <UTable :data="orders" :columns="columns" :loading="loading" class="w-full" />

      <div v-if="total > pageSize" class="flex justify-center py-3 border-t border-default">
        <UPagination v-model:page="page" :total="total" :items-per-page="pageSize" @update:page="loadOrders" />
      </div>
    </UCard>

    <!-- 订单详情 -->
    <UModal
      v-model:open="detailVisible"
      :title="$ts('module.system.myOrder.detailTitle')"
      :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[820px]', footer: 'justify-between' }"
    >
      <template #body>
        <div v-if="detail" class="space-y-4">
          <div class="flex items-center gap-3 flex-wrap">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border" :class="badgeClass(orderStatusConfig, detail.status)">
              {{ translate(orderStatusConfig, detail.status) }}
            </span>
            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border" :class="badgeClass(orderFulfillStatusConfig, detail.fulfillStatus)">
              {{ translate(orderFulfillStatusConfig, detail.fulfillStatus) }}
            </span>
            <UBadge v-if="detail.goodsType === 'service'" color="info" variant="subtle" size="sm">
              {{ $ts('module.system.goods.type.service') }}
            </UBadge>
          </div>

          <div class="flex gap-4">
            <div class="w-32 h-24 flex-shrink-0 rounded-md overflow-hidden bg-elevated flex items-center justify-center">
              <img v-if="detail.goodsCover" :src="detail.goodsCover ?? undefined" :alt="detail.goodsName ?? undefined" class="w-full h-full object-cover">
              <UIcon v-else name="i-lucide-package" class="size-7 text-muted" />
            </div>
            <div class="flex-1 min-w-0 space-y-1">
              <div class="font-medium break-all">{{ detail.goodsName }}</div>
              <div class="text-sm text-muted">
                ¥{{ detail.unitPrice }} × {{ detail.quantity }}
                <UBadge v-if="detail.priceSource === 'level'" color="success" variant="subtle" size="sm" class="ml-1">
                  {{ $ts('module.system.order.priceSource.level') }}
                </UBadge>
              </div>
              <div class="text-sm">
                {{ $ts('module.system.myOrder.payAmount') }}：
                <span class="font-semibold text-primary">¥{{ detail.payAmount }}</span>
                <span v-if="detail.discountAmount && detail.discountAmount !== '0.00'" class="text-xs text-muted">
                  （{{ $ts('module.system.myOrder.discountAmount') }} ¥{{ detail.discountAmount }}）
                </span>
              </div>
            </div>
          </div>

          <UCard variant="subtle" :ui="{ body: 'grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3' }">
            <UFormField
              v-for="item in detailItems"
              :key="item.label"
              :label="item.label"
              orientation="horizontal"
              :ui="{ root: 'items-start', labelWrapper: 'w-28 shrink-0 pt-1', container: 'min-w-0 flex-1' }"
            >
              <UInput :model-value="displayValue(item.value)" readonly color="neutral" variant="subtle" class="w-full" :ui="{ base: 'break-all' }" />
            </UFormField>
          </UCard>

          <UAlert
            v-if="detail.fulfillStatus === 'pending'"
            color="info"
            variant="subtle"
            icon="i-lucide-clock"
            :title="$ts('module.system.myOrder.fulfillPendingTitle')"
            :description="$ts('module.system.myOrder.fulfillPendingDesc')"
          />
          <UAlert
            v-else-if="detail.fulfillStatus === 'delivered'"
            color="success"
            variant="subtle"
            icon="i-lucide-circle-check"
            :title="$ts('module.system.myOrder.fulfillDeliveredTitle')"
            :description="detail.fulfillRemark || $ts('module.system.myOrder.fulfillDeliveredDesc')"
          />

          <UAlert
            v-if="detail.status === 'CL' && detail.closeReason"
            color="neutral"
            variant="subtle"
            icon="i-lucide-info"
            :title="$ts('module.system.myOrder.closeReason')"
            :description="detail.closeReason"
          />

          <!-- 在线支付：查看支付码 -->
          <template v-if="payInfo">
            <USeparator :label="$ts('module.system.myOrder.qrTitle')" />
            <div class="flex flex-col items-center gap-2">
              <img v-if="payInfo.qrImageUrl" :src="payInfo.qrImageUrl" alt="pay qrcode" class="max-w-[200px] rounded-md border border-default bg-white p-1">
              <UTextarea
                v-else-if="payInfo.qrContent"
                :model-value="payInfo.qrContent"
                readonly
                autoresize
                :rows="2"
                color="neutral"
                variant="subtle"
                class="w-full font-mono text-xs"
              />
              <div v-else class="text-xs text-muted">{{ $ts('module.system.myOrder.noQrcode') }}</div>

              <UButton v-if="payInfo.payUrl" :to="payInfo.payUrl" target="_blank" size="sm" variant="link" icon="i-lucide-external-link">
                {{ $ts('module.system.myOrder.openPayUrl') }}
              </UButton>
              <div class="text-xs text-muted">
                {{ $ts('module.system.myOrder.payExpireAt') }}：{{ displayValue(payInfo.expireAt) }}
              </div>
            </div>
          </template>
        </div>
      </template>

      <template #footer>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            v-if="detail && detail.status === 'WP' && detail.payMode === 'balance'"
            color="primary"
            icon="i-lucide-circle-check"
            :loading="acting"
            @click="handleConfirm(detail)"
          >
            {{ $ts('module.system.myOrder.confirm') }}
          </UButton>
          <UButton
            v-if="detail && detail.status === 'WP' && detail.payMode === 'online'"
            color="primary"
            variant="outline"
            icon="i-lucide-qr-code"
            :loading="acting"
            @click="handleShowQr(detail)"
          >
            {{ $ts('module.system.myOrder.viewQr') }}
          </UButton>
          <UButton
            v-if="detail && detail.status === 'WP'"
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            :loading="acting"
            @click="handleSync(detail)"
          >
            {{ $ts('module.system.myOrder.sync') }}
          </UButton>
          <Popconfirm
            v-if="detail && detail.status === 'WP'"
            :content="$ts('module.system.myOrder.cancelConfirm')"
            :positive-text="$ts('module.system.myOrder.cancel')"
            :loading="acting"
            @confirm="handleCancel(detail)"
          >
            <template #trigger>
              <UButton color="error" variant="outline" icon="i-lucide-x">
                {{ $ts('module.system.myOrder.cancel') }}
              </UButton>
            </template>
          </Popconfirm>
        </div>
        <UButton color="neutral" variant="subtle" @click="detailVisible = false">
          {{ $ts('common.close') }}
        </UButton>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '我的订单',
  icon: 'i-lucide-receipt'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysOrderRespDTO } from '#shared/system/order'
import {
  orderFulfillStatusConfig,
  orderPayModeRecord,
  orderPriceSourceRecord,
  orderStatusConfig
} from '#shared/constants/business'
import { badgeColorClasses } from '~/composables/badgeColorClasses'
import { useToastError, useToastSuccess } from '~/utils/toast'

type OrderRow = SysOrderRespDTO

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const status = ref<string | null>(null)
const page = ref(1)
const pageSize = 10
const total = ref(0)
const loading = ref(false)
const orders = ref<OrderRow[]>([])

const detailVisible = ref(false)
const detail = ref<OrderRow | null>(null)
const acting = ref(false)
const payInfo = ref<{ qrImageUrl?: string | null, qrContent?: string | null, payUrl?: string | null, expireAt?: string | null } | null>(null)

const statusItems = useTransformRecordToOption(
  Object.fromEntries(Object.entries(orderStatusConfig).map(([value, config]) => [value, config.i18nKey]))
)

const displayValue = (value: unknown) => (value == null || value === '' ? '-' : String(value))

const translate = (config: Readonly<Record<string, { i18nKey: string }>>, value?: string | null) => {
  const item = value ? config[value] : undefined

  return item ? $ts(item.i18nKey) : (value || '-')
}

const badgeClass = (config: Readonly<Record<string, { color: string }>>, value?: string | null) => {
  const item = value ? config[value] : undefined

  return badgeColorClasses[item?.color ?? 'neutral'] || badgeColorClasses.neutral
}

const recordLabel = (record: Record<string, string>, value?: string | null) => {
  const key = value ? record[value] : undefined

  return key ? $ts(key) : (value || '-')
}

const detailItems = computed(() => {
  const item = detail.value

  return [
    { label: $ts('module.system.myOrder.orderNo'), value: item?.orderNo },
    { label: $ts('module.system.myOrder.payMode'), value: recordLabel(orderPayModeRecord, item?.payMode) },
    { label: $ts('module.system.myOrder.priceSource'), value: recordLabel(orderPriceSourceRecord, item?.priceSource) },
    { label: $ts('module.system.myOrder.couponCode'), value: item?.couponCode },
    { label: $ts('module.system.myOrder.giftAmount'), value: item?.giftAmount },
    { label: $ts('module.system.myOrder.rechargeAmount'), value: item?.rechargeAmount },
    { label: $ts('module.system.myOrder.freezeId'), value: item?.freezeId },
    { label: $ts('module.system.myOrder.payOrderId'), value: item?.payOrderId },
    { label: $ts('module.system.myOrder.contact'), value: item?.contact },
    { label: $ts('module.system.myOrder.remark'), value: item?.remark },
    { label: $ts('module.system.myOrder.createdAt'), value: item?.createdAt },
    { label: $ts('module.system.myOrder.expireAt'), value: item?.expireAt },
    { label: $ts('module.system.myOrder.paidAt'), value: item?.paidAt },
    { label: $ts('module.system.myOrder.fulfilledAt'), value: item?.fulfilledAt },
    { label: $ts('module.system.myOrder.closedAt'), value: item?.closedAt },
    { label: $ts('module.system.myOrder.failReason'), value: item?.failReason }
  ]
})

const loadOrders = async (targetPage = page.value) => {
  loading.value = true
  page.value = targetPage

  try {
    const result = await $trpc.sysOrder.myPage.query({
      page: page.value,
      pageSize,
      status: (status.value ?? null) as 'WP' | 'OD' | 'CL' | 'FL' | null,
      fulfillStatus: null
    })

    orders.value = result.list as OrderRow[]
    total.value = result.total ?? 0
  } finally {
    loading.value = false
  }
}

const openDetail = async (row: OrderRow) => {
  payInfo.value = null
  detail.value = row
  detailVisible.value = true

  const latest = await $trpc.sysOrder.myDetail.query({ orderNo: row.orderNo as string })

  detail.value = latest as OrderRow
}

const handleConfirm = async (row: OrderRow) => {
  if (!row.orderNo) return

  acting.value = true

  try {
    await $trpc.sysOrder.myConfirm.mutate({ orderNo: row.orderNo })
    useToastSuccess($ts('module.system.myOrder.confirmSuccess'))
    await loadOrders(page.value)
    await openDetail({ ...row, orderNo: row.orderNo })
  } finally {
    acting.value = false
  }
}

const handleCancel = async (row: OrderRow) => {
  if (!row.orderNo) return

  acting.value = true

  try {
    await $trpc.sysOrder.myCancel.mutate({ orderNo: row.orderNo })
    useToastSuccess($ts('module.system.myOrder.cancelSuccess'))
    detailVisible.value = false
    await loadOrders(page.value)
  } finally {
    acting.value = false
  }
}

const handleSync = async (row: OrderRow) => {
  if (!row.orderNo) return

  acting.value = true

  try {
    const result = await $trpc.sysOrder.mySync.mutate({ orderNo: row.orderNo })

    if (result.changed) {
      useToastSuccess($ts('module.system.myOrder.syncSuccess'))
      await loadOrders(page.value)
      await openDetail({ ...row, orderNo: row.orderNo })
    } else {
      useToastError($ts('module.system.myOrder.syncUnchanged'))
    }
  } finally {
    acting.value = false
  }
}

/** 在线支付单：重新拉一次支付码（本地读支付单，不请求渠道） */
const handleShowQr = async (row: OrderRow) => {
  if (!row.orderNo) return

  acting.value = true

  try {
    payInfo.value = await $trpc.sysOrder.myPayment.query({ orderNo: row.orderNo }) as typeof payInfo.value
  } finally {
    acting.value = false
  }
}

const columns = computed<TableColumn<OrderRow>[]>(() => [
  {
    accessorKey: 'orderNo',
    header: () => $ts('module.system.myOrder.orderNo')
  },
  {
    id: 'goods',
    header: () => $ts('module.system.myOrder.goods'),
    cell: ({ row }) => h('div', { class: 'flex items-center gap-2' }, [
      h('div', { class: 'w-8 h-8 rounded overflow-hidden bg-elevated flex items-center justify-center flex-shrink-0' }, [
        row.original.goodsCover
          ? h('img', { src: row.original.goodsCover, class: 'w-full h-full object-cover' })
          : h(resolveComponent('UIcon'), { name: 'i-lucide-package', class: 'text-muted' })
      ]),
      h('span', { class: 'truncate max-w-52' }, row.original.goodsName ?? '-')
    ])
  },
  {
    id: 'amount',
    header: () => $ts('module.system.myOrder.payAmount'),
    cell: ({ row }) => h('span', { class: 'font-medium' }, `¥${row.original.payAmount ?? '0.00'}`)
  },
  {
    id: 'payMode',
    header: () => $ts('module.system.myOrder.payMode'),
    cell: ({ row }) => recordLabel(orderPayModeRecord, row.original.payMode)
  },
  {
    id: 'status',
    header: () => $ts('module.system.myOrder.status'),
    cell: ({ row }) => h('span', {
      class: `inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${badgeClass(orderStatusConfig, row.original.status)}`
    }, translate(orderStatusConfig, row.original.status))
  },
  {
    id: 'fulfillStatus',
    header: () => $ts('module.system.myOrder.fulfillStatus'),
    cell: ({ row }) => h('span', {
      class: `inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${badgeClass(orderFulfillStatusConfig, row.original.fulfillStatus)}`
    }, translate(orderFulfillStatusConfig, row.original.fulfillStatus))
  },
  {
    accessorKey: 'createdAt',
    header: () => $ts('module.system.myOrder.createdAt')
  },
  {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')

      return h('div', { class: 'flex flex-wrap gap-2' }, [
        h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          onClick: () => openDetail(row.original)
        }, { default: () => $ts('common.detail') })
      ])
    }
  }
])

onMounted(async () => {
  await loadOrders(1)
})
</script>
