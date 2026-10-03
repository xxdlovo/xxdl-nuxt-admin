<template>
  <div class="h-full p-3 space-y-3">
    <!-- 筛选 -->
    <UCard :ui="{ body: 'p-3' }">
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-[200px]">
          <UInput
            v-model="keyword"
            icon="i-lucide-search"
            :placeholder="$ts('module.system.mall.form.keyword')"
            class="w-full"
            @keyup.enter="loadGoods(1)"
          >
            <template #trailing>
              <UButton
                v-if="keyword"
                icon="i-lucide-x"
                color="neutral"
                variant="link"
                size="xs"
                @click="clearKeyword"
              />
            </template>
          </UInput>
        </div>
        <USelect v-model.nullable="type" :items="typeItems" :placeholder="$ts('module.system.mall.type')" class="w-40" clearable />
        <UButton icon="tabler:search" variant="outline" @click="loadGoods(1)">
          {{ $ts('common.search') }}
        </UButton>
        <UButton to="/system/wallet" icon="i-lucide-wallet" variant="outline" color="neutral">
          {{ $ts('module.system.wallet.title') }}
        </UButton>
        <UButton to="/system/my-orders" icon="i-lucide-receipt" variant="outline" color="neutral">
          {{ $ts('module.system.myOrder.title') }}
        </UButton>
      </div>
    </UCard>

    <!-- 商品网格 -->
    <div v-if="loading" class="py-16 text-center text-muted">
      <UIcon name="i-lucide-loader-circle" class="animate-spin size-6" />
    </div>
    <div v-else-if="goodsList.length === 0" class="py-16 text-center text-muted">
      {{ $ts('module.system.mall.empty') }}
    </div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      <UCard
        v-for="item in goodsList"
        :key="item.id"
        :ui="{ body: 'p-0' }"
        class="overflow-hidden flex flex-col cursor-pointer hover:ring-2 hover:ring-primary/40 transition"
        @click="openDetail(item)"
      >
        <div class="aspect-video bg-elevated flex items-center justify-center overflow-hidden">
          <img v-if="item.cover" :src="item.cover" :alt="item.name" class="w-full h-full object-cover">
          <UIcon v-else name="i-lucide-package" class="size-10 text-muted" />
        </div>
        <div class="p-3 flex-1 flex flex-col gap-2">
          <div class="flex items-start justify-between gap-2">
            <span class="font-medium leading-tight">{{ item.name }}</span>
            <UBadge v-if="item.type === 'service'" color="info" variant="subtle" size="sm">
              {{ $ts('module.system.goods.type.service') }}
            </UBadge>
          </div>
          <div v-if="item.subtitle" class="text-xs text-muted line-clamp-2">{{ item.subtitle }}</div>
          <div class="mt-auto flex items-end justify-between">
            <div class="flex flex-col">
              <span class="text-lg font-semibold text-primary">¥{{ item.myPrice }}</span>
              <span v-if="item.priceSource === 'level'" class="text-xs text-muted line-through">¥{{ item.price }}</span>
            </div>
            <div class="text-right text-xs text-muted">
              <div v-if="item.priceSource === 'level'" class="text-success">
                {{ item.levelName || $ts('module.system.order.priceSource.level') }}
              </div>
              <div>{{ stockText(item) }}</div>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <div v-if="total > pageSize" class="flex justify-center">
      <UPagination v-model:page="page" :total="total" :items-per-page="pageSize" @update:page="loadGoods" />
    </div>

    <!-- 商品详情 + 下单 -->
    <UModal
      v-model:open="detailVisible"
      :title="detail?.name || $ts('module.system.mall.detail')"
      :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[720px]' }"
    >
      <template #body>
        <div v-if="detail" class="space-y-4">
          <div class="flex gap-4">
            <div class="w-40 h-28 flex-shrink-0 rounded-md overflow-hidden bg-elevated flex items-center justify-center">
              <img v-if="detail.cover" :src="detail.cover" :alt="detail.name" class="w-full h-full object-cover">
              <UIcon v-else name="i-lucide-package" class="size-8 text-muted" />
            </div>
            <div class="flex-1 space-y-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium">{{ detail.name }}</span>
                <UBadge v-if="detail.type === 'service'" color="info" variant="subtle" size="sm">
                  {{ $ts('module.system.goods.type.service') }}
                </UBadge>
              </div>
              <div v-if="detail.subtitle" class="text-xs text-muted">{{ detail.subtitle }}</div>
              <div class="flex items-baseline gap-2">
                <span class="text-xl font-semibold text-primary">¥{{ detail.myPrice }}</span>
                <span v-if="detail.priceSource === 'level'" class="text-xs text-muted line-through">¥{{ detail.price }}</span>
                <UBadge v-if="detail.priceSource === 'level'" color="success" variant="subtle" size="sm">
                  {{ detail.levelName || $ts('module.system.order.priceSource.level') }}
                </UBadge>
              </div>
              <div class="text-xs text-muted">
                {{ stockText(detail) }} · {{ $ts('module.system.mall.sales') }} {{ detail.salesCount ?? 0 }}
              </div>
            </div>
          </div>

          <UAlert
            v-if="detail.type === 'service' && detail.serviceNotice"
            color="info"
            variant="subtle"
            icon="i-lucide-info"
            :title="$ts('module.system.mall.serviceNotice')"
            :description="detail.serviceNotice"
          />

          <div v-if="detail.detail" class="text-sm whitespace-pre-wrap rounded-md border border-default p-3 max-h-56 overflow-auto">
            {{ detail.detail }}
          </div>

          <USeparator :label="$ts('module.system.mall.orderTitle')" />

          <UForm :state="orderForm" class="space-y-4">
            <UFormField v-if="detail.type !== 'service'" name="quantity" :label="$ts('module.system.mall.quantity')">
              <UInputNumber v-model="orderForm.quantity" :min="1" :max="99" class="w-40" />
            </UFormField>
            <UFormField name="payMode" required :label="$ts('module.system.mall.payMode')">
              <URadioGroup v-model="orderForm.payMode" :items="payModeItems" orientation="horizontal" />
            </UFormField>
            <UFormField name="couponCode" :label="$ts('module.system.mall.couponCode')">
              <UBaseInput
                v-model="orderForm.couponCode"
                :placeholder="$ts('module.system.mall.form.couponCode')"
                trailing="clear"
                class="w-full"
                @blur="() => void checkCoupon()"
              />
              <template #help>
                <span v-if="couponChecking" class="inline-flex items-center gap-1 text-muted">
                  <UIcon name="i-lucide-loader-circle" class="animate-spin" />
                  {{ $ts('module.system.mall.couponChecking') }}
                </span>
                <span v-else-if="couponCheck?.valid" class="text-success">{{ couponHintText }}</span>
                <span v-else-if="couponCheck && !couponCheck.valid" class="text-error">{{ couponInvalidText }}</span>
                <span v-else class="text-muted">{{ $ts('module.system.mall.couponCodeHelp') }}</span>
              </template>
            </UFormField>
            <UFormField v-if="detail.type === 'service'" name="contact" required :label="$ts('module.system.mall.contact')" :help="$ts('module.system.mall.contactHelp')">
              <UBaseInput v-model="orderForm.contact" :placeholder="$ts('module.system.mall.form.contact')" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField v-if="detail.type === 'service'" name="remark" :label="$ts('module.system.mall.remark')">
              <UTextarea v-model="orderForm.remark" :rows="3" :placeholder="$ts('module.system.mall.form.remark')" class="w-full" />
            </UFormField>

            <!-- 总价随数量 / 优惠码自动更新：单价 × 数量 → 抵扣 → 应付 -->
            <div class="rounded-md border border-default bg-elevated p-3 text-sm space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-muted">{{ $ts('module.system.mall.totalAmount') }}</span>
                <span class="font-medium">¥{{ orderAmount }}</span>
              </div>
              <div class="text-xs text-muted text-right">
                {{ $ts('module.system.mall.unitPriceTimesQuantity', { price: detail.myPrice, quantity: String(orderQuantity) }) }}
              </div>
              <template v-if="couponCheck?.valid">
                <div class="flex items-center justify-between">
                  <span class="text-muted">{{ $ts('module.system.mall.couponDiscount') }}</span>
                  <span class="text-success">-¥{{ couponCheck.discountAmount ?? '0.00' }}</span>
                </div>
                <USeparator />
                <div class="flex items-center justify-between">
                  <span class="text-muted">{{ $ts('module.system.mall.payableAmount') }}</span>
                  <span class="font-semibold text-primary">¥{{ couponCheck.payableAmount ?? orderAmount }}</span>
                </div>
              </template>
            </div>
          </UForm>

          <!-- 在线支付：二维码 + 轮询 -->
          <template v-if="payInfo">
            <USeparator :label="$ts('module.system.mall.payNow')" />
            <div class="flex flex-col items-center gap-2">
              <img v-if="payInfo.qrImageUrl" :src="payInfo.qrImageUrl" alt="pay qrcode" class="max-w-[220px] rounded-md border border-default bg-white p-1">
              <template v-else-if="payInfo.qrContent">
                <UTextarea :model-value="payInfo.qrContent" readonly autoresize :rows="2" color="neutral" variant="subtle" class="w-full font-mono text-xs" />
                <div class="text-xs text-muted">{{ $ts('module.system.mall.qrContentTip') }}</div>
              </template>
              <div v-else class="text-xs text-muted">{{ $ts('module.system.mall.noQrcode') }}</div>

              <UButton v-if="payInfo.payUrl" :to="payInfo.payUrl" target="_blank" size="sm" variant="link" icon="i-lucide-external-link">
                {{ $ts('module.system.mall.openPayUrl') }}
              </UButton>

              <div class="text-xs text-muted">
                {{ $ts('module.system.mall.orderNo') }}：<span class="break-all">{{ payInfo.orderNo }}</span>
              </div>
              <div class="text-xs text-muted">{{ $ts('module.system.mall.payAmount') }}：{{ payInfo.payAmount }}</div>
              <div class="flex items-center gap-2">
                <UBadge :color="payInfo.status === 'OD' ? 'success' : 'warning'" variant="subtle">
                  {{ orderStatusLabel(payInfo.status) }}
                </UBadge>
                <span v-if="polling" class="text-xs text-muted inline-flex items-center gap-1">
                  <UIcon name="i-lucide-loader-circle" class="animate-spin" />
                  {{ $ts('module.system.mall.polling') }}
                </span>
              </div>
              <UButton
                v-if="payInfo.status !== 'OD'"
                size="xs"
                variant="outline"
                color="neutral"
                icon="i-lucide-refresh-cw"
                :loading="syncing"
                @click="syncOrder"
              >
                {{ $ts('module.system.mall.syncNow') }}
              </UButton>
            </div>
          </template>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full items-center justify-between gap-2">
          <UButton color="neutral" variant="subtle" @click="closeDetail">
            {{ $ts('common.close') }}
          </UButton>
          <UButton
            v-if="!payInfo"
            color="primary"
            icon="i-lucide-shopping-cart"
            :loading="creating"
            :disabled="couponChecking || (detail?.type === 'service' && !orderForm.contact.trim())"
            @click="submitOrder"
          >
            {{ detail?.type === 'service'
              ? $ts('module.system.mall.buyService')
              : $ts('module.system.mall.buyNow') }}
          </UButton>
          <UButton v-else-if="payInfo.status === 'OD'" color="primary" icon="i-lucide-receipt" @click="goMyOrders">
            {{ $ts('module.system.mall.goMyOrders') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '商城',
  icon: 'i-lucide-store'
})

import type { SysMallGoodsRespDTO } from '#shared/system/goods'
import type { SysMemberCouponCheckRespDTO } from '#shared/system/member'
import type { SysOrderCreateRespDTO } from '#shared/system/order'
import { goodsTypeRecord, orderStatusConfig } from '#shared/constants/business'
import { randomUuid } from '#shared/utils/uuid'
import { useToastError, useToastSuccess, useToastWarning } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const keyword = ref('')
const type = ref<string | null>(null)
const page = ref(1)
const pageSize = 12
const total = ref(0)
const loading = ref(false)
const goodsList = ref<SysMallGoodsRespDTO[]>([])

const detailVisible = ref(false)
const detail = ref<SysMallGoodsRespDTO | null>(null)
const creating = ref(false)
const syncing = ref(false)
const polling = ref(false)

const orderForm = reactive({
  quantity: 1,
  payMode: 'balance' as 'balance' | 'online',
  couponCode: '',
  contact: '',
  remark: ''
})

/** 本次下单数量：服务类固定 1 份，其余按表单（与提交时的口径一致） */
const orderQuantity = computed(() => detail.value?.type === 'service' ? 1 : Math.max(1, orderForm.quantity))

/** 本次下单金额 = 我的价格 × 数量（只用于展示与优惠码预校验，服务端会重新计算并以此为准） */
const orderAmount = computed(() => {
  const price = Number(detail.value?.myPrice ?? 0)

  return (price * orderQuantity.value).toFixed(2)
})

/** 优惠码校验结果（null = 未填或尚未校验） */
const couponCheck = ref<SysMemberCouponCheckRespDTO | null>(null)
const couponChecking = ref(false)

const resetCouponCheck = () => {
  couponCheck.value = null
}

/**
 * 下单前主动校验优惠码（场景 consume）：
 * 无效就地提示并拦下，不浪费一次「扣库存 + 落单 + 冻结/下单」的完整链路。
 * 服务端在真正下单时会用同一套规则再校验一次（这里是前置提示，不是唯一防线）。
 */
const checkCoupon = async (): Promise<boolean> => {
  const code = orderForm.couponCode.trim()

  if (!code) {
    resetCouponCheck()

    return true
  }

  couponChecking.value = true

  try {
    couponCheck.value = await $trpc.sysMember.myCouponCheck.query({
      code,
      amount: orderAmount.value,
      scene: 'consume'
    })

    return couponCheck.value.valid
  } finally {
    couponChecking.value = false
  }
}

// 数量变化（或换了商品）会让门槛与抵扣额失效，需要重新校验
watch([() => orderForm.quantity, () => detail.value?.id], () => {
  if (orderForm.couponCode.trim()) {
    void checkCoupon()
  }
})

/** 校验通过后的提示：金额明细统一在下方「总价」区展示，这里只说明券可用 */
const couponHintText = computed(() => {
  const result = couponCheck.value

  if (!result?.valid) {
    return ''
  }

  // 纯赠送金券（没有抵扣额）额外点出赠送金额，否则只说一句「可用」
  const giftOnly = (!result.discountAmount || result.discountAmount === '0.00')
    && !!result.giftAmount && result.giftAmount !== '0.00'

  return giftOnly
    ? $ts('module.system.mall.couponValidGift', { gift: result.giftAmount ?? '-' })
    : $ts('module.system.mall.couponValid')
})

/** 校验失败文案：金额相关的两类错误要把金额作为参数传给 i18n */
const couponInvalidText = computed(() => {
  const reason = couponCheck.value?.reason || 'module.system.member.couponNotFound'

  if (reason === 'module.system.member.couponMinAmount') {
    return $ts(reason, { message: couponCheck.value?.minAmount ?? '-' })
  }

  // 面值大于订单金额：提示「订单金额需大于 ¥X 才可使用」
  if (reason === 'module.system.member.couponNotApplicable') {
    return $ts('module.system.mall.couponRequiredTip', { amount: couponCheck.value?.requiredAmount ?? '-' })
  }

  return $ts(reason)
})

/** 在线支付结果（含二维码）；余额支付不填这个，直接提示已冻结 */
const payInfo = ref<{
  orderNo: string
  status: string
  payAmount: string
  qrImageUrl?: string | null
  qrContent?: string | null
  payUrl?: string | null
} | null>(null)

let pollTimer: ReturnType<typeof setTimeout> | null = null
let pollStartedAt = 0
let pollFailures = 0
const POLL_INTERVAL = 5000
const POLL_TIMEOUT = 10 * 60 * 1000

const typeItems = useTransformRecordToOption(goodsTypeRecord)
const payModeItems = computed(() => [
  { label: $ts('module.system.order.payMode.balance'), value: 'balance' },
  { label: $ts('module.system.order.payMode.online'), value: 'online' }
])

const orderStatusLabel = (status?: string | null) => {
  const item = status ? orderStatusConfig[status] : undefined

  return item ? $ts(item.i18nKey) : (status || '-')
}

const stockText = (item: SysMallGoodsRespDTO) => {
  if (item.unlimitedStock === 1) {
    return $ts('module.system.mall.stockUnlimited')
  }

  return `${$ts('module.system.mall.stock')} ${item.stock ?? 0}`
}

const loadGoods = async (targetPage = page.value) => {
  loading.value = true
  page.value = targetPage

  try {
    const result = await $trpc.sysOrder.mallList.query({
      page: page.value,
      pageSize,
      keyword: keyword.value.trim() || null,
      type: (type.value ?? null) as 'virtual' | 'service' | 'physical' | null
    })

    goodsList.value = result.list as SysMallGoodsRespDTO[]
    total.value = result.total ?? 0
  } finally {
    loading.value = false
  }
}

const clearKeyword = () => {
  keyword.value = ''
  void loadGoods(1)
}

const resetOrderForm = () => {
  orderForm.quantity = 1
  orderForm.payMode = 'balance'
  orderForm.couponCode = ''
  orderForm.contact = ''
  orderForm.remark = ''
  payInfo.value = null
  resetCouponCheck()
}

const openDetail = async (item: SysMallGoodsRespDTO) => {
  resetOrderForm()
  detailVisible.value = true

  // 详情用服务端数据（价格可能随等级变化，不要直接用列表里的旧值）
  detail.value = await $trpc.sysOrder.mallDetail.query({ goodsId: item.id }) as SysMallGoodsRespDTO
}

const stopPolling = () => {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }

  polling.value = false
}

const scheduleNextPoll = () => {
  pollTimer = setTimeout(async () => {
    if (!payInfo.value) {
      stopPolling()
      return
    }

    if (Date.now() - pollStartedAt > POLL_TIMEOUT) {
      stopPolling()
      useToastError($ts('module.system.mall.pollTimeout'))
      return
    }

    try {
      await syncOrder()
      pollFailures = 0
    } catch {
      pollFailures += 1

      if (pollFailures >= 3) {
        stopPolling()
        useToastError($ts('module.system.mall.pollFailed'))
        return
      }
    }

    if (payInfo.value?.status === 'WP') {
      scheduleNextPoll()
    } else {
      stopPolling()
    }
  }, POLL_INTERVAL)
}

const startPolling = () => {
  stopPolling()
  polling.value = true
  pollStartedAt = Date.now()
  pollFailures = 0
  scheduleNextPoll()
}

const syncOrder = async () => {
  if (!payInfo.value) return

  syncing.value = true

  try {
    const result = await $trpc.sysOrder.mySync.mutate({ orderNo: payInfo.value.orderNo })

    payInfo.value.status = result.status

    if (result.status === 'OD') {
      stopPolling()
      useToastSuccess($ts('module.system.mall.paid'))
    }
  } finally {
    syncing.value = false
  }
}

const submitOrder = async () => {
  if (!detail.value) return

  // 下单前先校验优惠码：无效就地拦下，不进入「扣库存 + 落单 + 冻结/下单」链路
  if (!(await checkCoupon())) {
    useToastError($ts('module.system.mall.couponInvalid'))

    return
  }

  creating.value = true
  stopPolling()

  try {
    const result = await $trpc.sysOrder.myCreate.mutate({
      goodsId: detail.value.id,
      quantity: detail.value.type === 'service' ? 1 : orderForm.quantity,
      couponCode: orderForm.couponCode.trim() || null,
      payMode: orderForm.payMode,
      contact: orderForm.contact.trim() || null,
      remark: orderForm.remark.trim() || null,
      requestId: randomUuid()
    }) as SysOrderCreateRespDTO

    if (result.reused) {
      useToastWarning($ts('module.system.mall.orderReused'))
    }

    if (result.payMode === 'balance') {
      useToastSuccess($ts('module.system.mall.balanceFrozen', { amount: result.payAmount }))
      closeDetail()
      await navigateTo('/system/my-orders')

      return
    }

    payInfo.value = {
      orderNo: result.orderNo,
      status: result.status,
      payAmount: result.payAmount,
      qrImageUrl: result.qrImageUrl,
      qrContent: result.qrContent,
      payUrl: result.payUrl
    }

    if (result.status === 'WP') {
      startPolling()
    }
  } finally {
    creating.value = false
  }
}

const closeDetail = () => {
  stopPolling()
  detailVisible.value = false
}

const goMyOrders = async () => {
  closeDetail()
  await navigateTo('/system/my-orders')
}

onMounted(async () => {
  await loadGoods(1)
})

onBeforeUnmount(stopPolling)
</script>
