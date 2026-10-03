<script setup lang="ts">
import type { SysMemberRechargeDto } from '#shared/system/memberRecharge'
import {
  memberCouponSceneRecord,
  memberCouponTypeRecord,
  memberRechargeStatusConfig,
  payChannelCodeRecord,
  payModeRecord,
  payOrderStatusConfig
} from '#shared/constants/business'
import { badgeColorClasses } from '~/composables/badgeColorClasses'

/**
 * 详情行：getById 已改为联表返回，除充值单本体外还带 `coupon*` 与 `linkedPay*` 两组前缀字段
 * （关联不到时为 null）。shared 的输出 schema 仍是列表与详情共用的本体字段，
 * 这里就地补上联表字段，避免为一次展示改动 shared。
 */
type SysMemberRechargeProfile = SysMemberRechargeDto & {
  couponName?: string | null
  couponType?: string | null
  couponValue?: string | number | null
  couponMinAmount?: string | number | null
  couponGiftAmount?: string | number | null
  couponScene?: string | null
  couponValidFrom?: string | null
  couponValidTo?: string | null
  couponMaxUse?: number | null
  couponUsedCount?: number | null
  couponPerUserLimit?: number | null
  couponBatchNo?: string | null
  couponStatus?: number | null
  couponRemark?: string | null
  linkedPayOutTradeNo?: string | null
  linkedPayStatus?: string | null
  linkedPayChannelCode?: string | null
  linkedPayMode?: string | null
  linkedPayAmount?: string | number | null
  linkedPayCurrency?: string | null
  linkedPaySubject?: string | null
  linkedPayProviderStatus?: string | null
  linkedPayProviderOrderId?: string | null
  linkedPayTransactionId?: string | null
  linkedPayNotifyCount?: number | null
  linkedPayPaidAt?: string | null
  linkedPayExpireAt?: string | null
  linkedPayFailReason?: string | null
  linkedPayCreatedAt?: string | null
}

/** 主弹窗字段：coupon / payOrder 两类要渲染成可点击入口，其余是普通只读文本 */
type DetailItem = {
  label: string
  value?: unknown
  kind: 'text' | 'coupon' | 'payOrder'
}

/** 二级弹窗字段：badge 存在时渲染成彩色徽标（状态），否则渲染成只读输入框 */
type ProfileField = {
  label: string
  value?: unknown
  /** class 允许缺省：`badgeColorClasses` 是动态索引取值，类型上是 `string | undefined` */
  badge?: { label: string, class?: string }
}

const props = defineProps<{
  visible: boolean
  data?: SysMemberRechargeDto | null
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

/** 打开弹窗时按 id 拉一次最新单据；拿不到就退回列表行数据，避免弹窗空白 */
const latest = ref<SysMemberRechargeDto | null>(null)
const loading = ref(false)

/** 二级弹窗：优惠码 / 关联支付单，数据都来自详情行，不再单独发请求 */
const couponVisible = ref(false)
const payOrderVisible = ref(false)

const detail = computed(() => (latest.value ?? props.data ?? null) as SysMemberRechargeProfile | null)

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

/** 充值单状态彩色标签，复用 shared 常量里的徽标配置 */
const statusBadge = computed(() => badge(memberRechargeStatusConfig, detail.value?.status))

/** 优惠码状态：1 启用 / 0 停用 / 2 已作废（与优惠码列表页 memberCouponStatusConfig 口径一致） */
const memberCouponStatusConfig: Readonly<Record<string, { i18nKey: string, color: string }>> = {
  '1': { i18nKey: 'module.system.memberCoupon.status.enabled', color: 'success' },
  '0': { i18nKey: 'module.system.memberCoupon.status.disabled', color: 'neutral' },
  '2': { i18nKey: 'module.system.memberCoupon.status.void', color: 'error' }
}

const couponStatusBadge = computed(() => badge(
  memberCouponStatusConfig,
  detail.value?.couponStatus == null ? null : String(detail.value.couponStatus)
))

const linkedPayBadge = computed(() => badge(payOrderStatusConfig, detail.value?.linkedPayStatus))

const detailItems = computed<DetailItem[]>(() => {
  const item = detail.value

  return [
    { label: $ts('module.system.memberRecharge.outTradeNo'), value: item?.outTradeNo, kind: 'text' },
    { label: $ts('module.system.memberRecharge.userId'), value: item?.userId, kind: 'text' },
    { label: $ts('module.system.memberRecharge.amount'), value: item?.amount, kind: 'text' },
    { label: $ts('module.system.memberRecharge.giftAmount'), value: item?.giftAmount, kind: 'text' },
    { label: $ts('module.system.memberRecharge.discountAmount'), value: item?.discountAmount, kind: 'text' },
    { label: $ts('module.system.memberRecharge.payAmount'), value: item?.payAmount, kind: 'text' },
    // 优惠码：可点击打开二级详情，展示名称（小字附码）；couponId 为空时保持不可点击
    { label: $ts('module.system.memberRecharge.couponCode'), value: item?.couponName || item?.couponCode, kind: 'coupon' },
    { label: $ts('module.system.memberRecharge.couponId'), value: item?.couponId, kind: 'text' },
    { label: $ts('module.system.memberRecharge.payChannelCode'), value: translate(payChannelCodeRecord, item?.payChannelCode), kind: 'text' },
    // 关联支付单：可点击打开二级详情，展示商户订单号 + 支付状态徽标；payOrderId 为空时不可点击
    { label: $ts('module.system.memberRecharge.payOrderId'), value: item?.linkedPayOutTradeNo || item?.payOrderId, kind: 'payOrder' },
    { label: $ts('module.system.memberRecharge.paidAt'), value: item?.paidAt, kind: 'text' },
    { label: $ts('module.system.memberRecharge.creditedAt'), value: item?.creditedAt, kind: 'text' },
    { label: $ts('module.system.memberRecharge.expireAt'), value: item?.expireAt, kind: 'text' },
    { label: $ts('module.system.memberRecharge.failReason'), value: item?.failReason, kind: 'text' },
    { label: $ts('module.system.memberRecharge.createdAt'), value: item?.createdAt, kind: 'text' },
    { label: $ts('module.system.memberRecharge.updatedAt'), value: item?.updatedAt, kind: 'text' },
    { label: $ts('module.system.memberRecharge.remark'), value: item?.remark, kind: 'text' }
  ]
})

const couponDetailItems = computed<ProfileField[]>(() => {
  const item = detail.value

  return [
    { label: $ts('module.system.memberCoupon.code'), value: item?.couponCode },
    { label: $ts('module.system.memberCoupon.name'), value: item?.couponName },
    { label: $ts('module.system.memberCoupon.typeLabel'), value: translate(memberCouponTypeRecord, item?.couponType) },
    { label: $ts('module.system.memberCoupon.value'), value: item?.couponValue },
    { label: $ts('module.system.memberCoupon.minAmount'), value: item?.couponMinAmount },
    { label: $ts('module.system.memberCoupon.giftAmount'), value: item?.couponGiftAmount },
    { label: $ts('module.system.memberCoupon.sceneLabel'), value: translate(memberCouponSceneRecord, item?.couponScene) },
    { label: $ts('module.system.memberCoupon.validFrom'), value: item?.couponValidFrom },
    { label: $ts('module.system.memberCoupon.validTo'), value: item?.couponValidTo },
    { label: $ts('module.system.memberCoupon.maxUse'), value: item?.couponMaxUse },
    // 已用次数：详情行没有单独的 usedCount 标签，用「已用/上限」的 usage 承载
    { label: $ts('module.system.memberCoupon.usage'), value: item?.couponUsedCount },
    { label: $ts('module.system.memberCoupon.perUserLimit'), value: item?.couponPerUserLimit },
    { label: $ts('module.system.memberCoupon.batchNo'), value: item?.couponBatchNo },
    { label: $ts('module.system.memberCoupon.statusLabel'), badge: couponStatusBadge.value },
    { label: $ts('module.system.memberCoupon.remark'), value: item?.couponRemark }
  ]
})

const payOrderDetailItems = computed<ProfileField[]>(() => {
  const item = detail.value

  return [
    { label: $ts('module.system.payOrder.outTradeNo'), value: item?.linkedPayOutTradeNo },
    { label: $ts('module.system.payOrder.statusLabel'), badge: linkedPayBadge.value },
    { label: $ts('module.system.payOrder.channelCode'), value: translate(payChannelCodeRecord, item?.linkedPayChannelCode) },
    { label: $ts('module.system.payOrder.payMode'), value: translate(payModeRecord, item?.linkedPayMode) },
    { label: $ts('module.system.payOrder.amount'), value: item ? `${item.linkedPayAmount ?? '-'} ${item.linkedPayCurrency ?? ''}`.trim() : '-' },
    { label: $ts('module.system.payOrder.subject'), value: item?.linkedPaySubject },
    { label: $ts('module.system.payOrder.providerStatus'), value: item?.linkedPayProviderStatus },
    { label: $ts('module.system.payOrder.providerOrderId'), value: item?.linkedPayProviderOrderId },
    { label: $ts('module.system.payOrder.transactionId'), value: item?.linkedPayTransactionId },
    { label: $ts('module.system.payOrder.notifyCount'), value: item?.linkedPayNotifyCount },
    { label: $ts('module.system.payOrder.paidAt'), value: item?.linkedPayPaidAt },
    { label: $ts('module.system.payOrder.expireAt'), value: item?.linkedPayExpireAt },
    { label: $ts('module.system.payOrder.failReason'), value: item?.linkedPayFailReason },
    { label: $ts('module.system.payOrder.createdAt'), value: item?.linkedPayCreatedAt }
  ]
})

const loadDetail = async () => {
  const id = props.data?.id

  latest.value = null

  if (!id) {
    return
  }

  loading.value = true
  try {
    latest.value = await $trpc.sysMemberRecharge.getById.query(id) as SysMemberRechargeDto
  } catch {
    // 详情接口失败（例如单据已被删除）时退回列表行数据，错误提示由全局 tRPC 链路给出
    latest.value = null
  } finally {
    loading.value = false
  }
}

watch(visible, (opened) => {
  if (opened) {
    void loadDetail()
  } else {
    // 主弹窗关闭时收起二级弹窗，避免下次打开残留上一次的详情
    couponVisible.value = false
    payOrderVisible.value = false
  }
})
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="$ts('module.system.memberRecharge.detailTitle')"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[900px]', footer: 'justify-end' }"
  >
    <template #body>
      <div v-if="detail" class="space-y-4">
        <div class="flex items-center gap-3">
          <span class="text-sm text-muted">{{ $ts('module.system.memberRecharge.statusLabel') }}</span>
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border" :class="statusBadge.class">
            {{ statusBadge.label }}
          </span>
          <UIcon v-if="loading" name="i-lucide-loader-circle" class="animate-spin text-muted" />
        </div>

        <UCard variant="subtle" :ui="{ body: 'space-y-4' }">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <UFormField
              v-for="item in detailItems"
              :key="item.label"
              :label="item.label"
              orientation="horizontal"
              :ui="{ root: 'items-start', labelWrapper: 'w-28 shrink-0 pt-1', container: 'min-w-0 flex-1' }"
            >
              <!-- 优惠码：couponId 有值时可点开二级详情 -->
              <template v-if="item.kind === 'coupon'">
                <div v-if="detail.couponId" class="flex flex-wrap items-center gap-x-2 min-w-0">
                  <UButton
                    variant="link"
                    size="xs"
                    class="px-0 h-auto"
                    :title="$ts('module.system.memberRecharge.viewCoupon')"
                    @click="couponVisible = true"
                  >
                    {{ displayValue(item.value) }}
                  </UButton>
                  <span class="text-xs text-muted break-all">{{ detail.couponCode || '' }}</span>
                </div>
                <UInput
                  v-else
                  model-value="-"
                  readonly
                  color="neutral"
                  variant="subtle"
                  class="w-full"
                  :ui="{ base: 'break-all' }"
                />
              </template>

              <!-- 关联支付单：payOrderId 有值时可点开二级详情，并带支付状态徽标 -->
              <template v-else-if="item.kind === 'payOrder'">
                <div v-if="detail.payOrderId" class="flex flex-wrap items-center gap-2 min-w-0">
                  <UButton
                    variant="link"
                    size="xs"
                    class="px-0 h-auto"
                    :title="$ts('module.system.memberRecharge.viewPayOrder')"
                    @click="payOrderVisible = true"
                  >
                    {{ displayValue(item.value) }}
                  </UButton>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border" :class="linkedPayBadge.class">
                    {{ linkedPayBadge.label }}
                  </span>
                </div>
                <UInput
                  v-else
                  model-value="-"
                  readonly
                  color="neutral"
                  variant="subtle"
                  class="w-full"
                  :ui="{ base: 'break-all' }"
                />
              </template>

              <UInput
                v-else
                :model-value="displayValue(item.value)"
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
    </template>

    <template #footer>
      <UButton color="neutral" variant="subtle" @click="visible = false">
        {{ $ts('common.close') }}
      </UButton>
    </template>
  </UModal>

  <!-- 二级弹窗：关联的优惠码详情（只读） -->
  <UModal
    v-model:open="couponVisible"
    :title="$ts('module.system.memberRecharge.couponDetailTitle')"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[900px]', footer: 'justify-end' }"
  >
    <template #body>
      <UCard variant="subtle" :ui="{ body: 'space-y-4' }">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          <UFormField
            v-for="field in couponDetailItems"
            :key="field.label"
            :label="field.label"
            orientation="horizontal"
            :ui="{ root: 'items-start', labelWrapper: 'w-28 shrink-0 pt-1', container: 'min-w-0 flex-1' }"
          >
            <template v-if="field.badge">
              <span
                class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border"
                :class="field.badge.class"
              >
                {{ field.badge.label }}
              </span>
            </template>
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
    </template>

    <template #footer>
      <UButton color="neutral" variant="subtle" @click="couponVisible = false">
        {{ $ts('common.close') }}
      </UButton>
    </template>
  </UModal>

  <!-- 二级弹窗：关联的支付单详情（只读） -->
  <UModal
    v-model:open="payOrderVisible"
    :title="$ts('module.system.memberRecharge.payOrderDetailTitle')"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[900px]', footer: 'justify-end' }"
  >
    <template #body>
      <UCard variant="subtle" :ui="{ body: 'space-y-4' }">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          <UFormField
            v-for="field in payOrderDetailItems"
            :key="field.label"
            :label="field.label"
            orientation="horizontal"
            :ui="{ root: 'items-start', labelWrapper: 'w-28 shrink-0 pt-1', container: 'min-w-0 flex-1' }"
          >
            <template v-if="field.badge">
              <span
                class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border"
                :class="field.badge.class"
              >
                {{ field.badge.label }}
              </span>
            </template>
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
    </template>

    <template #footer>
      <UButton color="neutral" variant="subtle" @click="payOrderVisible = false">
        {{ $ts('common.close') }}
      </UButton>
    </template>
  </UModal>
</template>
