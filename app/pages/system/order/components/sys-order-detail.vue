<script setup lang="ts">
import type { SysOrderRespDTO } from '#shared/system/order'
import {
  goodsTypeRecord,
  orderFulfillStatusConfig,
  orderPayModeRecord,
  orderPriceSourceRecord,
  orderStatusConfig
} from '#shared/constants/business'
import { badgeColorClasses } from '~/composables/badgeColorClasses'

const props = defineProps<{
  visible: boolean
  data?: SysOrderRespDTO | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

/** 详情以服务端最新数据为准：列表行可能已经过期（他人操作 / 定时关单） */
const detail = ref<SysOrderRespDTO | null>(null)
const loading = ref(false)

const displayValue = (value: unknown) => {
  if (value == null || value === '') {
    return '-'
  }

  return String(value)
}

const money = (value?: string | number | null) => (value == null || value === '' ? '-' : `¥${value}`)

const recordLabel = (record: Record<string, string>, value?: string | null) => {
  if (!value) return '-'
  const key = record[value]

  return key ? $ts(key) : value
}

/** 状态 / 履约 / 类型 / 价格来源的彩色标签 */
const badge = (config: Readonly<Record<string, { i18nKey: string, color: string }>>, value?: string | null) => {
  const item = value ? config[value] : undefined

  if (!item) {
    return { label: value || '-', class: badgeColorClasses.neutral }
  }

  return {
    label: $ts(item.i18nKey),
    class: badgeColorClasses[item.color] || badgeColorClasses.neutral
  }
}

const statusBadge = computed(() => badge(orderStatusConfig, detail.value?.status))
const fulfillBadge = computed(() => badge(orderFulfillStatusConfig, detail.value?.fulfillStatus))

const priceSourceLabel = computed(() => recordLabel(orderPriceSourceRecord, detail.value?.priceSource))
/** 等级价是权益兑现的关键信号，用成功色徽标高亮 */
const priceSourceHighlight = computed(() => detail.value?.priceSource === 'level')

const isService = computed(() => detail.value?.goodsType === 'service')

const moneyItems = computed(() => {
  const item = detail.value

  return [
    { label: $ts('module.system.order.totalAmount'), value: money(item?.totalAmount) },
    { label: $ts('module.system.order.discountAmount'), value: money(item?.discountAmount) },
    { label: $ts('module.system.order.payAmount'), value: money(item?.payAmount) },
    { label: $ts('module.system.order.giftAmount'), value: money(item?.giftAmount) },
    { label: $ts('module.system.order.rechargeAmount'), value: money(item?.rechargeAmount) }
  ]
})

const memberItems = computed(() => {
  const item = detail.value

  return [
    { label: $ts('module.system.order.nickname'), value: item?.nickname },
    { label: $ts('module.system.order.username'), value: item?.username },
    { label: $ts('module.system.order.phone'), value: item?.phone },
    { label: $ts('module.system.order.levelName'), value: item?.levelName }
  ]
})

const orderItems = computed(() => {
  const item = detail.value

  return [
    { label: $ts('module.system.order.orderNo'), value: item?.orderNo },
    { label: $ts('module.system.order.payModeLabel'), value: recordLabel(orderPayModeRecord, item?.payMode) },
    { label: $ts('module.system.order.couponCode'), value: item?.couponCode },
    { label: $ts('module.system.order.freezeId'), value: item?.freezeId },
    { label: $ts('module.system.order.payOrderId'), value: item?.payOrderId },
    { label: $ts('module.system.order.payChannelCode'), value: item?.payChannelCode },
    { label: $ts('module.system.order.contact'), value: item?.contact },
    { label: $ts('module.system.order.remark'), value: item?.remark }
  ]
})

/** 时间轴：只展示真实发生过的节点，未发生的留空不占位 */
const timelineItems = computed(() => {
  const item = detail.value

  const nodes = [
    { key: 'created', label: $ts('module.system.order.createdAt'), value: item?.createdAt, icon: 'i-lucide-plus-circle' },
    { key: 'expire', label: $ts('module.system.order.expireAt'), value: item?.expireAt, icon: 'i-lucide-timer' },
    { key: 'paid', label: $ts('module.system.order.paidAt'), value: item?.paidAt, icon: 'i-lucide-circle-check' },
    { key: 'finished', label: $ts('module.system.order.finishedAt'), value: item?.finishedAt, icon: 'i-lucide-flag' },
    { key: 'closed', label: $ts('module.system.order.closedAt'), value: item?.closedAt, icon: 'i-lucide-x-circle' }
  ]

  return nodes.filter(node => node.value != null && node.value !== '')
})

const loadDetail = async () => {
  const id = props.data?.id

  if (!id) {
    detail.value = props.data ?? null
    return
  }

  loading.value = true

  try {
    const result = await $trpc.sysOrder.getById.query(id)
    detail.value = (result ?? props.data) as SysOrderRespDTO
  } catch {
    // 详情拉取失败时退化为列表行数据，避免弹窗空白
    detail.value = props.data ?? null
  } finally {
    loading.value = false
  }
}

watch(visible, (opened) => {
  if (opened) {
    detail.value = props.data ?? null
    void loadDetail()
  }
})
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="$ts('module.system.order.detailTitle')"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[900px]', footer: 'justify-end' }"
  >
    <template #body>
      <div v-if="detail" class="space-y-4">
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-sm text-muted">{{ $ts('module.system.order.statusLabel') }}</span>
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border" :class="statusBadge.class">
            {{ statusBadge.label }}
          </span>
          <template v-if="isService">
            <span class="text-sm text-muted">{{ $ts('module.system.order.fulfillStatusLabel') }}</span>
            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border" :class="fulfillBadge.class">
              {{ fulfillBadge.label }}
            </span>
          </template>
          <span
            v-if="detail.priceSource"
            class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border"
            :class="priceSourceHighlight ? badgeColorClasses.success : badgeColorClasses.neutral"
          >
            {{ priceSourceLabel }}
          </span>
          <UIcon v-if="loading" name="i-lucide-loader-circle" class="animate-spin text-muted" />
        </div>

        <!-- 商品快照：下单时的名称与单价，商品后续改价不影响历史单 -->
        <UCard variant="subtle" :ui="{ body: 'space-y-3' }">
          <div class="text-sm font-medium">{{ $ts('module.system.order.goodsSection') }}</div>
          <div class="flex items-start gap-4">
            <img
              v-if="detail.goodsCover"
              :src="detail.goodsCover"
              alt="goods cover"
              class="w-16 h-16 rounded-md border border-default object-cover flex-shrink-0"
            >
            <div class="min-w-0 flex-1 space-y-1">
              <div class="font-medium break-all">{{ displayValue(detail.goodsName) }}</div>
              <div class="flex flex-wrap items-center gap-2">
                <span
                  v-if="detail.goodsType"
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
                  :class="badgeColorClasses.neutral"
                >
                  {{ recordLabel(goodsTypeRecord, detail.goodsType) }}
                </span>
                <span class="text-xs text-muted">
                  {{ $ts('module.system.order.unitPrice') }}：{{ money(detail.unitPrice) }}
                </span>
                <span class="text-xs text-muted">
                  {{ $ts('module.system.order.quantity') }}：{{ displayValue(detail.quantity) }}
                </span>
              </div>
              <div class="text-xs text-muted break-all">
                {{ $ts('module.system.order.goodsId') }}：{{ displayValue(detail.goodsId) }}
              </div>
            </div>
          </div>
        </UCard>

        <UCard variant="subtle" :ui="{ body: 'space-y-4' }">
          <div class="text-sm font-medium">{{ $ts('module.system.order.moneySection') }}</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <UFormField
              v-for="item in moneyItems"
              :key="item.label"
              :label="item.label"
              orientation="horizontal"
              :ui="{ root: 'items-start', labelWrapper: 'w-28 shrink-0 pt-1', container: 'min-w-0 flex-1' }"
            >
              <UInput :model-value="item.value" readonly color="neutral" variant="subtle" class="w-full" />
            </UFormField>
          </div>
        </UCard>

        <UCard variant="subtle" :ui="{ body: 'space-y-4' }">
          <div class="text-sm font-medium">{{ $ts('module.system.order.memberSection') }}</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <UFormField
              v-for="item in memberItems"
              :key="item.label"
              :label="item.label"
              orientation="horizontal"
              :ui="{ root: 'items-start', labelWrapper: 'w-28 shrink-0 pt-1', container: 'min-w-0 flex-1' }"
            >
              <UInput :model-value="displayValue(item.value)" readonly color="neutral" variant="subtle" class="w-full" :ui="{ base: 'break-all' }" />
            </UFormField>
          </div>
        </UCard>

        <UCard variant="subtle" :ui="{ body: 'space-y-4' }">
          <div class="text-sm font-medium">{{ $ts('module.system.order.traceSection') }}</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <UFormField
              v-for="item in orderItems"
              :key="item.label"
              :label="item.label"
              orientation="horizontal"
              :ui="{ root: 'items-start', labelWrapper: 'w-28 shrink-0 pt-1', container: 'min-w-0 flex-1' }"
            >
              <UInput :model-value="displayValue(item.value)" readonly color="neutral" variant="subtle" class="w-full" :ui="{ base: 'break-all' }" />
            </UFormField>
          </div>
        </UCard>

        <UCard v-if="isService" variant="subtle" :ui="{ body: 'space-y-4' }">
          <div class="text-sm font-medium">{{ $ts('module.system.order.fulfillSection') }}</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <UFormField :label="$ts('module.system.order.fulfillStatusLabel')" orientation="horizontal" :ui="{ root: 'items-start', labelWrapper: 'w-28 shrink-0 pt-1', container: 'min-w-0 flex-1' }">
              <div class="pt-1.5">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border" :class="fulfillBadge.class">
                  {{ fulfillBadge.label }}
                </span>
              </div>
            </UFormField>
            <UFormField :label="$ts('module.system.order.fulfilledAt')" orientation="horizontal" :ui="{ root: 'items-start', labelWrapper: 'w-28 shrink-0 pt-1', container: 'min-w-0 flex-1' }">
              <UInput :model-value="displayValue(detail.fulfilledAt)" readonly color="neutral" variant="subtle" class="w-full" />
            </UFormField>
            <UFormField :label="$ts('module.system.order.fulfillRemark')" orientation="horizontal" :ui="{ root: 'items-start', labelWrapper: 'w-28 shrink-0 pt-1', container: 'min-w-0 flex-1' }">
              <UInput :model-value="displayValue(detail.fulfillRemark)" readonly color="neutral" variant="subtle" class="w-full" :ui="{ base: 'break-all' }" />
            </UFormField>
            <UFormField :label="$ts('module.system.order.fulfillOperatorId')" orientation="horizontal" :ui="{ root: 'items-start', labelWrapper: 'w-28 shrink-0 pt-1', container: 'min-w-0 flex-1' }">
              <UInput :model-value="displayValue(detail.fulfillOperatorId)" readonly color="neutral" variant="subtle" class="w-full" :ui="{ base: 'break-all' }" />
            </UFormField>
          </div>
        </UCard>

        <UAlert
          v-if="detail.closeReason"
          color="neutral"
          variant="subtle"
          icon="i-lucide-info"
          :title="$ts('module.system.order.closeReason')"
          :description="detail.closeReason"
        />

        <UAlert
          v-if="detail.failReason"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="$ts('module.system.order.failReason')"
          :description="detail.failReason"
        />

        <USeparator :label="$ts('module.system.order.timeline')" />

        <div v-if="timelineItems.length === 0" class="py-2 text-center text-sm text-muted">
          {{ $ts('module.system.order.noTimeline') }}
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="node in timelineItems"
            :key="node.key"
            class="rounded-md border border-default p-3 text-xs flex flex-wrap items-center gap-3"
          >
            <UIcon :name="node.icon" class="text-muted" />
            <span class="font-medium">{{ node.label }}</span>
            <span class="text-muted">{{ node.value }}</span>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <UButton color="neutral" variant="subtle" @click="visible = false">
        {{ $ts('common.close') }}
      </UButton>
    </template>
  </UModal>
</template>
