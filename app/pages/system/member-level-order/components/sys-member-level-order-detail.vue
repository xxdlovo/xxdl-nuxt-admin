<script setup lang="ts">
import { payChannelCodeRecord, payOrderStatusConfig } from '#shared/constants/business'
import { badgeColorClasses } from '~/composables/badgeColorClasses'
import { memberLevelOrderPayModeRecord, type MemberLevelOrderDetail } from './types'

/**
 * 会员开通单详情（只读）。
 *
 * 数据直接用列表行：`sysMemberLevelOrder` 的响应契约已经把单据全字段 + 会员联表字段
 * （nickname / username / phone）带回，本页不再多发一次 getById —— 也就不会依赖
 * 尚未落地的详情接口。关联支付单信息取行里的 `payOrderId` / `payChannelCode` / `paidAt`，
 * 后端若额外联表带出 `linkedPay*` 前缀字段，这里也会一并展示。
 */
const props = defineProps<{
  visible: boolean
  data?: MemberLevelOrderDetail | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const { $ts } = useI18n()

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const detail = computed<MemberLevelOrderDetail | null>(() => props.data ?? null)

const displayValue = (value: unknown) => {
  if (value == null || value === '') {
    return '-'
  }

  return String(value)
}

const translate = (record: Record<string, string>, value?: string | null) => {
  if (!value) return '-'
  const key = record[value]

  return key ? $ts(key) : value
}

/** 徽标配置（i18nKey + color）→ 文案与配色，避免拼不出动态 key */
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

/** 开通单状态：复用支付状态常量（WP / OD / CL / FL） */
const statusBadge = computed(() => badge(payOrderStatusConfig, detail.value?.status))

const memberText = computed(() => {
  const item = detail.value
  if (!item) return '-'

  const name = item.nickname || item.username || ''

  return name ? `${name}（${item.userId || '-'}）` : (item.userId || '-')
})

/** 生效区间：endAt 为空表示长期 / 不设期限 */
const periodText = computed(() => {
  const item = detail.value
  const start = item?.startAt || '-'
  const end = item?.endAt || $ts('module.system.memberLevelOrder.longTerm')

  return `${start} ~ ${end}`
})

/** 本单时长：0 = 长期 */
const durationText = computed(() => {
  const days = Number(detail.value?.durationDays ?? 0)

  return days > 0
    ? $ts('module.system.memberLevelOrder.durationDaysValue', { days: String(days) })
    : $ts('module.system.memberLevelOrder.longTerm')
})

type DetailField = {
  label: string
  value?: unknown
  badge?: { label: string, class?: string }
  /** 占满整行（备注、失败原因这类长文本） */
  wide?: boolean
}

const detailFields = computed<DetailField[]>(() => {
  const item = detail.value

  return [
    { label: $ts('module.system.memberLevelOrder.outTradeNo'), value: item?.outTradeNo },
    { label: $ts('module.system.memberLevelOrder.member'), value: memberText.value },
    { label: $ts('module.system.memberLevelOrder.levelName'), value: item?.levelName },
    { label: $ts('module.system.memberLevelOrder.levelId'), value: item?.levelId },
    { label: $ts('module.system.memberLevelOrder.durationDays'), value: durationText.value },
    { label: $ts('module.system.memberLevelOrder.priceAmount'), value: item?.priceAmount },
    { label: $ts('module.system.memberLevelOrder.payAmount'), value: item?.payAmount },
    { label: $ts('module.system.memberLevelOrder.payModeLabel'), value: translate(memberLevelOrderPayModeRecord, item?.payMode) },
    { label: $ts('module.system.memberLevelOrder.statusLabel'), badge: statusBadge.value },
    { label: $ts('module.system.memberLevelOrder.period'), value: periodText.value },
    { label: $ts('module.system.memberLevelOrder.startAt'), value: item?.startAt },
    { label: $ts('module.system.memberLevelOrder.endAt'), value: item?.endAt || $ts('module.system.memberLevelOrder.longTerm') },
    { label: $ts('module.system.memberLevelOrder.paidAt'), value: item?.paidAt },
    { label: $ts('module.system.memberLevelOrder.effectiveAt'), value: item?.effectiveAt },
    // 注意：开通单的 expireAt 是「支付超时时间」，不是等级到期时间
    { label: $ts('module.system.memberLevelOrder.expireAt'), value: item?.expireAt },
    { label: $ts('module.system.memberLevelOrder.freezeId'), value: item?.freezeId },
    { label: $ts('module.system.memberLevelOrder.requestId'), value: item?.requestId },
    { label: $ts('module.system.memberLevelOrder.createdAt'), value: item?.createdAt },
    { label: $ts('module.system.memberLevelOrder.updatedAt'), value: item?.updatedAt },
    { label: $ts('module.system.memberLevelOrder.failReason'), value: item?.failReason, wide: true },
    { label: $ts('module.system.memberLevelOrder.remark'), value: item?.remark, wide: true }
  ]
})

/**
 * 关联支付单：在线支付才有；单据没关联支付单时整块不展示。
 * 列表/详情联表只带出 payOrderId / payChannelCode / paidAt，因此这里以这三项为主，
 * 后端若扩展了 `linkedPay*` 前缀字段则自动补进来；空值行直接过滤掉，避免整屏 `-`。
 */
const hasPayOrder = computed(() => Boolean(detail.value?.payOrderId))

const linkedPayStatusBadge = computed(() => badge(payOrderStatusConfig, detail.value?.linkedPayStatus))

const payOrderFields = computed<DetailField[]>(() => {
  const item = detail.value

  const fields: DetailField[] = [
    { label: $ts('module.system.memberLevelOrder.payOrderId'), value: item?.payOrderId },
    { label: $ts('module.system.payOrder.outTradeNo'), value: item?.linkedPayOutTradeNo },
    { label: $ts('module.system.payOrder.statusLabel'), badge: linkedPayStatusBadge.value },
    { label: $ts('module.system.payOrder.channelCode'), value: translate(payChannelCodeRecord, item?.linkedPayChannelCode || item?.payChannelCode) },
    { label: $ts('module.system.payOrder.payMode'), value: item?.linkedPayMode },
    {
      label: $ts('module.system.payOrder.amount'),
      value: item?.linkedPayAmount != null ? `${item.linkedPayAmount} ${item.linkedPayCurrency ?? ''}`.trim() : undefined
    },
    { label: $ts('module.system.payOrder.providerStatus'), value: item?.linkedPayProviderStatus },
    { label: $ts('module.system.payOrder.providerOrderId'), value: item?.linkedPayProviderOrderId },
    { label: $ts('module.system.payOrder.transactionId'), value: item?.linkedPayTransactionId },
    { label: $ts('module.system.payOrder.paidAt'), value: item?.linkedPayPaidAt || item?.paidAt },
    { label: $ts('module.system.payOrder.expireAt'), value: item?.linkedPayExpireAt },
    { label: $ts('module.system.payOrder.failReason'), value: item?.linkedPayFailReason },
    { label: $ts('module.system.payOrder.createdAt'), value: item?.linkedPayCreatedAt }
  ]

  return fields.filter(field => Boolean(field.badge) || (field.value != null && field.value !== '' && field.value !== '-'))
})

const formItemUi = {
  root: 'items-start',
  labelWrapper: 'w-32 shrink-0 pt-1',
  container: 'min-w-0 flex-1'
}
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="$ts('module.system.memberLevelOrder.detailTitle')"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[900px]', footer: 'justify-end' }"
  >
    <template #body>
      <div v-if="detail" class="space-y-4">
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-sm text-muted">{{ $ts('module.system.memberLevelOrder.statusLabel') }}</span>
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border" :class="statusBadge.class">
            {{ statusBadge.label }}
          </span>
          <span class="text-sm text-muted">{{ detail.levelName || detail.levelId || '-' }}</span>
        </div>

        <UCard variant="subtle" :ui="{ body: 'space-y-4' }">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <UFormField
              v-for="field in detailFields"
              :key="field.label"
              :label="field.label"
              orientation="horizontal"
              :ui="formItemUi"
              :class="field.wide ? 'md:col-span-2' : ''"
            >
              <span
                v-if="field.badge"
                class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border"
                :class="field.badge.class"
              >
                {{ field.badge.label }}
              </span>
              <UInput
                v-else
                :model-value="displayValue(field.value)"
                readonly
                color="neutral"
                variant="subtle"
                class="w-full"
                :ui="{ base: 'break-all' }"
              />
            </UFormField>
          </div>
        </UCard>

        <UCard v-if="hasPayOrder" variant="subtle" :ui="{ body: 'space-y-4' }">
          <template #header>
            <span class="text-sm font-medium text-default">{{ $ts('module.system.memberLevelOrder.linkedPayTitle') }}</span>
          </template>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <UFormField
              v-for="field in payOrderFields"
              :key="field.label"
              :label="field.label"
              orientation="horizontal"
              :ui="formItemUi"
            >
              <span
                v-if="field.badge"
                class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border"
                :class="field.badge.class"
              >
                {{ field.badge.label }}
              </span>
              <UInput
                v-else
                :model-value="displayValue(field.value)"
                readonly
                color="neutral"
                variant="subtle"
                class="w-full"
                :ui="{ base: 'break-all' }"
              />
            </UFormField>
          </div>
        </UCard>
      </div>

      <UEmpty
        v-else
        icon="i-lucide-receipt-text"
        :title="$ts('module.system.memberLevelOrder.emptyDetail')"
        :description="$ts('module.system.memberLevelOrder.emptyDetailDesc')"
        variant="soft"
      />
    </template>

    <template #footer>
      <UButton color="neutral" variant="subtle" @click="visible = false">
        {{ $ts('common.close') }}
      </UButton>
    </template>
  </UModal>
</template>
