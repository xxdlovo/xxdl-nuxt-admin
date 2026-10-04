<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import { randomUuid } from '#shared/utils/uuid'
import { orderPayModeRecord, payOrderStatusConfig } from '#shared/constants/business'
import { badgeColorClasses } from '~/composables/badgeColorClasses'
import { useToastError, useToastSuccess, useToastWarning } from '~/utils/toast'

/**
 * 会员中心（个人中心 → 会员中心 tab）：自助开通 / 续费会员等级。
 *
 * 数据来源全部是 `sysMember` 的自助接口（登录即可访问，不校验后台权限）：
 * - `myLevelOptions` 可购买等级；`myLevelOrders` 我的开通记录；
 * - `myOpenLevel` 下单；`myLevelOrderStatus` 本地状态；`myLevelOrderSync` 主动向渠道同步。
 *
 * 轮询骨架照搬 `app/pages/system/wallet/index.vue`：
 * 5 秒一次本地状态（`myLevelOrderStatus`），约 30 秒或用户点「同步状态」才向渠道打一次
 * （`myLevelOrderSync`），超时 10 分钟、连续失败 3 次即停；终态 OD/CL/FL 停轮询并刷新。
 *
 * 展示用的档案数据一律走 `useMemberProfileStore`（该 store 只用于展示，
 * 不得用于权限或金额判断，约定见 stores/memberProfile.ts 文件头）。
 */

/** 可购买等级（`sysMember.myLevelOptions` 返回项） */
type MyLevelOption = {
  id?: string | null
  name?: string | null
  benefit?: string | null
  price?: string | null
  durationDays?: number | null
  isLongTerm?: number | null
  isDefault?: number | null
  isCurrent?: boolean | number | null
}

/** 开通记录（`sysMember.myLevelOrders` 返回项，字段与开通单据一致） */
type MyLevelOrder = {
  id?: string | null
  outTradeNo?: string | null
  levelName?: string | null
  priceAmount?: string | null
  payAmount?: string | null
  payMode?: string | null
  status?: string | null
  startAt?: string | null
  endAt?: string | null
  effectiveAt?: string | null
  failReason?: string | null
  createdAt?: string | null
}

/** `myOpenLevel` 返回：待支付时用二维码三件套，余额 / 免费单直接是终态 */
type OpenLevelResult = {
  orderId?: string | null
  outTradeNo?: string | null
  status?: string | null
  levelId?: string | null
  levelName?: string | null
  payMode?: string | null
  priceAmount?: string | null
  payAmount?: string | null
  expireAt?: string | null
  effectiveAt?: string | null
  endAt?: string | null
  qrImageUrl?: string | null
  qrContent?: string | null
  payUrl?: string | null
  reused?: boolean | null
}

/** `myLevelOrderStatus` / `myLevelOrderSync` 返回 */
type LevelOrderStatus = {
  outTradeNo?: string | null
  status?: string | null
  failReason?: string | null
  effectiveAt?: string | null
  endAt?: string | null
}

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const memberProfileStore = useMemberProfileStore()

const loading = ref(false)
const levelOptions = ref<MyLevelOption[]>([])
const orders = ref<MyLevelOrder[]>([])
const ordersLoading = ref(false)

const dialogOpen = ref(false)
const targetLevel = ref<MyLevelOption | null>(null)
const payMode = ref<'balance' | 'online'>('balance')
const submitting = ref(false)

/** 本次下单的待支付单据（余额 / 免费单不会停留在这里） */
const currentOrder = ref<{
  outTradeNo: string
  levelName?: string | null
  payAmount?: string | null
  qrImageUrl?: string | null
  qrContent?: string | null
  payUrl?: string | null
} | null>(null)
const currentStatus = ref('WP')
const currentTerminalReason = ref<string | null>(null)
const syncing = ref(false)
const polling = ref(false)

let pollTimer: ReturnType<typeof setTimeout> | null = null
let pollStartedAt = 0
let pollFailures = 0
/** 最近一次「向渠道同步」的时间：本地状态每 5 秒查，渠道约 30 秒才打一次 */
let lastSyncAt = 0

const POLL_INTERVAL = 5000
const POLL_TIMEOUT = 10 * 60 * 1000
const SYNC_INTERVAL = 30000

/**
 * 等级来源文案（取值约定见建表脚本：manual/open/renew/upgrade/default/auto_expire）。
 * 属于「业务结论」，与支付状态一样用代码内常量映射，不走可被后台改坏的字典表。
 * 因为只在前端展示，这里就地声明，不额外动 shared 常量。
 */
const levelSourceRecord: Record<string, string> = {
  manual: 'module.system.profile.memberSourceMap.manual',
  open: 'module.system.profile.memberSourceMap.open',
  renew: 'module.system.profile.memberSourceMap.renew',
  upgrade: 'module.system.profile.memberSourceMap.upgrade',
  default: 'module.system.profile.memberSourceMap.default',
  auto_expire: 'module.system.profile.memberSourceMap.autoExpire'
}

const profile = computed(() => memberProfileStore.profile)
const currentLevelName = computed(() => profile.value?.levelName ?? null)
const currentExpireAt = computed(() => profile.value?.expireAt ?? null)
const currentLevelStartAt = computed(() => profile.value?.levelStartAt ?? null)

/** 到期时间统一 `YYYY-MM-DD HH:mm:ss`；replace 是为了兼容 Safari 解析带空格的日期串 */
const toTimestamp = (value?: string | null) => Date.parse(String(value ?? '').replace(/-/g, '/'))

const isExpired = computed(() => {
  const value = currentExpireAt.value

  return Boolean(value) && Number.isFinite(toTimestamp(value)) && toTimestamp(value) < Date.now()
})

const levelSourceText = computed(() => {
  const source = profile.value?.levelSource
  const key = source ? levelSourceRecord[source] : ''

  return key ? $ts(key) : '-'
})

/** 金额文本：0 元显示「免费」 */
const priceText = (value?: string | number | null) => {
  const amount = Number(value ?? 0)

  if (!Number.isFinite(amount) || amount <= 0) {
    return $ts('module.system.profile.memberFree')
  }

  return $ts('module.system.memberLevel.priceValue', { price: amount.toFixed(2) })
}

/** 时长文本：长期等级 / durationDays = 0 显示「长期」 */
const durationText = (option: MyLevelOption) => {
  const days = Number(option.durationDays ?? 0)

  if (Number(option.isLongTerm ?? 0) === 1 || days <= 0) {
    return $ts('module.system.memberLevel.longTerm')
  }

  return $ts('module.system.memberLevel.durationDaysValue', { days: String(days) })
}

/** 当前等级 → 「续费」，其它等级 → 「开通/升级」 */
const actionLabel = (option: MyLevelOption) => Number(option.isCurrent ?? 0) === 1 || option.isCurrent === true
  ? $ts('module.system.profile.memberRenew')
  : $ts('module.system.profile.memberOpen')

const isFreeTarget = computed(() => {
  const amount = Number(targetLevel.value?.price ?? 0)

  return !Number.isFinite(amount) || amount <= 0
})

const payModeItems = computed(() => [
  { label: $ts('module.system.order.payMode.balance'), value: 'balance' as const },
  { label: $ts('module.system.order.payMode.online'), value: 'online' as const }
])

const payModeLabel = (mode?: string | null) => {
  if (!mode) {
    return '-'
  }

  if (mode === 'free') {
    return $ts('module.system.profile.memberPayModeFree')
  }

  const key = orderPayModeRecord[mode]

  return key ? $ts(key) : mode
}

/** 单据状态徽标：复用支付状态常量（WP/OD/CL/FL） */
const statusBadge = (status?: string | null) => {
  const item = status ? payOrderStatusConfig[status] : undefined

  return {
    label: item ? $ts(item.i18nKey) : (status || '-'),
    class: badgeColorClasses[item?.color ?? 'neutral'] || badgeColorClasses.neutral
  }
}

const currentStatusClass = computed(() => badgeColorClasses[payOrderStatusConfig[currentStatus.value]?.color ?? 'neutral'])

/** 单据终结后的结果提示（待支付时不展示，二维码取而代之） */
const currentTerminalAlert = computed(() => {
  if (currentStatus.value === 'OD') {
    return {
      color: 'success' as const,
      icon: 'i-lucide-circle-check',
      title: $ts('module.system.profile.memberOpenSuccess'),
      description: $ts('module.system.profile.memberOpenSuccessDesc')
    }
  }

  if (currentStatus.value === 'CL') {
    return {
      color: 'warning' as const,
      icon: 'i-lucide-circle-slash',
      title: $ts('module.system.profile.memberOrderClosed'),
      description: $ts('module.system.profile.memberOrderClosedDesc')
    }
  }

  return {
    color: 'error' as const,
    icon: 'i-lucide-triangle-alert',
    title: $ts('module.system.profile.memberOrderFailed'),
    description: $ts('module.system.profile.memberOrderFailedDesc')
  }
})

const orderColumns = computed<TableColumn<MyLevelOrder>[]>(() => [
  { accessorKey: 'levelName', header: () => $ts('module.system.profile.memberOrderLevel') },
  { accessorKey: 'payAmount', header: () => $ts('module.system.profile.memberOrderAmount') },
  {
    id: 'payMode',
    header: () => $ts('module.system.profile.memberPayMode'),
    cell: ({ row }) => payModeLabel(row.original.payMode)
  },
  {
    id: 'status',
    header: () => $ts('module.system.profile.memberOrderStatus'),
    cell: ({ row }) => {
      const badge = statusBadge(row.original.status)

      return h('span', { class: `inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${badge.class}` }, badge.label)
    }
  },
  {
    id: 'period',
    header: () => $ts('module.system.profile.memberOrderPeriod'),
    cell: ({ row }) => {
      const start = row.original.startAt || '-'
      const end = row.original.endAt || $ts('module.system.member.neverExpire')

      return `${start} ~ ${end}`
    }
  },
  { accessorKey: 'createdAt', header: () => $ts('module.system.profile.memberOrderCreatedAt') }
])

const loadLevels = async () => {
  loading.value = true

  try {
    levelOptions.value = await $trpc.sysMember.myLevelOptions.query()
  } finally {
    loading.value = false
  }
}

const loadOrders = async () => {
  ordersLoading.value = true

  try {
    orders.value = await $trpc.sysMember.myLevelOrders.query()
  } finally {
    ordersLoading.value = false
  }
}

/** 当前状态 + 可购买等级 + 开通记录一起来一遍（开通 / 续费成功后调用） */
const refreshAll = async () => {
  await Promise.all([loadLevels(), loadOrders(), memberProfileStore.refresh()])
}

// ── 轮询（骨架与 wallet 页一致） ─────────────────────────────────────────

const stopPolling = () => {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }

  polling.value = false
}

/** 本地状态查询：不打渠道，5 秒一次 */
const checkOrderStatus = async () => {
  if (!currentOrder.value) return

  const result = await $trpc.sysMember.myLevelOrderStatus.query({
    outTradeNo: currentOrder.value.outTradeNo
  }) as LevelOrderStatus

  await applyOrderStatus(result)
}

/** 主动向渠道同步：约 30 秒一次或用户点「同步状态」时调用，避免高频打渠道 */
const syncOrderStatus = async () => {
  if (!currentOrder.value) return

  syncing.value = true

  try {
    const result = await $trpc.sysMember.myLevelOrderSync.mutate({
      outTradeNo: currentOrder.value.outTradeNo
    }) as LevelOrderStatus

    lastSyncAt = Date.now()
    await applyOrderStatus(result)
  } finally {
    syncing.value = false
  }
}

/** 统一的单据状态落地：OD 停轮询 + 刷新 + 成功提示；CL/FL 停轮询 + 展示原因 */
const applyOrderStatus = async (result: LevelOrderStatus) => {
  currentStatus.value = result.status || 'WP'
  currentTerminalReason.value = result.failReason ?? null

  if (currentStatus.value === 'OD') {
    stopPolling()
    useToastSuccess($ts('module.system.profile.memberOpenSuccess'), undefined, currentOrder.value?.levelName ?? undefined)
    await refreshAll()

    return
  }

  if (currentStatus.value !== 'WP') {
    stopPolling()
    await Promise.all([loadLevels(), loadOrders()])
    useToastWarning(
      currentStatus.value === 'CL'
        ? $ts('module.system.profile.memberOrderClosed')
        : $ts('module.system.profile.memberOrderFailed'),
      undefined,
      result.failReason ?? undefined
    )
  }
}

const scheduleNextPoll = () => {
  pollTimer = setTimeout(async () => {
    if (!currentOrder.value) {
      stopPolling()
      return
    }

    if (Date.now() - pollStartedAt > POLL_TIMEOUT) {
      stopPolling()
      useToastError($ts('module.system.wallet.pollTimeout'))
      return
    }

    try {
      // 每 5 秒只查本地状态；约 30 秒才向渠道同步一次，避免每轮都打渠道
      if (Date.now() - lastSyncAt >= SYNC_INTERVAL) {
        await syncOrderStatus()
      } else {
        await checkOrderStatus()
      }

      pollFailures = 0
    } catch {
      pollFailures += 1

      if (pollFailures >= 3) {
        stopPolling()
        useToastError($ts('module.system.wallet.pollFailed'))
        return
      }
    }

    if (currentStatus.value === 'WP') {
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
  // 0 表示首轮（5 秒后）就向渠道同步一次，用户不必等满 30 秒
  lastSyncAt = 0
  pollFailures = 0
  scheduleNextPoll()
}

// ── 开通 / 续费 ─────────────────────────────────────────────────────────

const openDialog = (option: MyLevelOption) => {
  targetLevel.value = option
  payMode.value = 'balance'
  currentOrder.value = null
  currentStatus.value = 'WP'
  currentTerminalReason.value = null
  stopPolling()
  dialogOpen.value = true
}

/** 关闭弹窗：停轮询；未支付的单据会被刷新进「开通记录」（状态 WP） */
const closeDialog = () => {
  const hadPendingOrder = Boolean(currentOrder.value) && currentStatus.value === 'WP'

  stopPolling()
  currentOrder.value = null
  dialogOpen.value = false

  if (hadPendingOrder) {
    void loadOrders()
  }
}

const submitOpenLevel = async () => {
  const level = targetLevel.value

  if (!level?.id || submitting.value) {
    return
  }

  submitting.value = true
  stopPolling()

  try {
    const result = await $trpc.sysMember.myOpenLevel.mutate({
      levelId: level.id,
      // 免费等级 / 余额支付：契约只允许 balance | online，0 元单由服务端直接置 OD
      payMode: isFreeTarget.value ? 'balance' : payMode.value,
      requestId: randomUuid()
    }) as OpenLevelResult

    currentOrder.value = {
      outTradeNo: result.outTradeNo || '',
      levelName: result.levelName ?? level.name ?? null,
      payAmount: result.payAmount ?? null,
      qrImageUrl: result.qrImageUrl ?? null,
      qrContent: result.qrContent ?? null,
      payUrl: result.payUrl ?? null
    }
    currentStatus.value = result.status || 'WP'
    currentTerminalReason.value = null

    if (result.reused) {
      useToastWarning($ts('module.system.profile.memberOrderReused'))
    }

    // 余额 / 免费单直接是终态：提示成功 + 刷新，不进入二维码与轮询
    if (currentStatus.value === 'OD') {
      useToastSuccess($ts('module.system.profile.memberOpenSuccess'), undefined, currentOrder.value.levelName ?? undefined)
      await refreshAll()

      return
    }

    if (currentStatus.value === 'WP') {
      startPolling()

      return
    }

    stopPolling()
    await loadOrders()
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await refreshAll()
})

onBeforeUnmount(stopPolling)
</script>

<template>
  <div class="space-y-3">
    <!-- 1. 当前会员状态 -->
    <UCard :ui="{ body: 'space-y-4' }">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-crown" />
            <span>{{ $ts('module.system.profile.memberStatusTitle') }}</span>
          </div>
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            size="xs"
            :loading="loading || ordersLoading"
            :label="$ts('common.refresh')"
            @click="refreshAll"
          />
        </div>
      </template>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div class="text-xs text-muted">{{ $ts('module.system.member.level') }}</div>
          <div class="mt-1">
            <UBadge v-if="currentLevelName" :label="currentLevelName" color="warning" variant="soft" icon="i-lucide-crown" />
            <span v-else class="text-sm text-muted">{{ $ts('module.system.profile.memberNoLevel') }}</span>
          </div>
        </div>
        <div>
          <div class="text-xs text-muted">{{ $ts('module.system.member.expireAtColumn') }}</div>
          <div class="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <template v-if="currentExpireAt">
              <span>{{ currentExpireAt }}</span>
              <UBadge v-if="isExpired" :label="$ts('module.system.member.expired')" color="error" variant="soft" size="sm" />
            </template>
            <UBadge v-else :label="$ts('module.system.member.neverExpire')" color="success" variant="soft" size="sm" />
          </div>
        </div>
        <div>
          <div class="text-xs text-muted">{{ $ts('module.system.profile.memberSource') }}</div>
          <div class="mt-1 text-sm">{{ levelSourceText }}</div>
        </div>
        <div>
          <div class="text-xs text-muted">{{ $ts('module.system.profile.memberLevelStartAt') }}</div>
          <div class="mt-1 text-sm">{{ currentLevelStartAt || '-' }}</div>
        </div>
      </div>

      <UAlert
        v-if="isExpired"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="$ts('module.system.profile.memberExpiredTitle')"
        :description="$ts('module.system.profile.memberExpiredDesc')"
      />
    </UCard>

    <!-- 2. 可购买等级 -->
    <UCard :ui="{ body: 'space-y-3' }">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-medal" />
          <span>{{ $ts('module.system.profile.memberLevelsTitle') }}</span>
        </div>
      </template>

      <div v-if="loading" class="py-8 text-center text-sm text-muted">{{ $ts('common.loading') }}</div>

      <UEmpty
        v-else-if="levelOptions.length === 0"
        icon="i-lucide-medal"
        :title="$ts('module.system.profile.memberNoLevels')"
        :description="$ts('module.system.profile.memberNoLevelsDesc')"
        variant="soft"
      />

      <div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="option in levelOptions"
          :key="String(option.id ?? option.name ?? '')"
          class="flex flex-col gap-3 rounded-lg border p-4"
          :class="Number(option.isCurrent ?? 0) === 1 || option.isCurrent === true ? 'border-primary-400 dark:border-primary-500' : 'border-default'"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-base font-semibold text-default">{{ option.name || '-' }}</span>
            <UBadge v-if="Number(option.isCurrent ?? 0) === 1 || option.isCurrent === true" :label="$ts('module.system.profile.memberCurrent')" color="primary" variant="soft" size="sm" />
            <UBadge v-if="Number(option.isDefault ?? 0) === 1" :label="$ts('module.system.memberLevel.isDefault')" color="neutral" variant="soft" size="sm" />
          </div>

          <p class="min-h-[2.5rem] text-xs text-muted">{{ option.benefit || $ts('module.system.profile.memberNoBenefit') }}</p>

          <div class="flex items-end justify-between gap-2">
            <span class="text-xl font-semibold text-default">{{ priceText(option.price) }}</span>
            <span class="text-xs text-muted">{{ durationText(option) }}</span>
          </div>

          <UButton
            block
            :color="Number(option.isCurrent ?? 0) === 1 || option.isCurrent === true ? 'primary' : 'neutral'"
            :variant="Number(option.isCurrent ?? 0) === 1 || option.isCurrent === true ? 'solid' : 'outline'"
            :label="actionLabel(option)"
            @click="openDialog(option)"
          />
        </div>
      </div>
    </UCard>

    <!-- 3. 开通记录 -->
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-receipt-text" />
          <span>{{ $ts('module.system.profile.memberOrdersTitle') }}</span>
        </div>
      </template>

      <UTable :data="orders" :columns="orderColumns" :loading="ordersLoading" class="w-full" />
    </UCard>

    <!-- 4. 开通 / 续费弹窗：下单后原地切换到二维码 + 轮询 -->
    <UModal v-model:open="dialogOpen" :title="actionLabel(targetLevel ?? {})" :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[560px]' }">
      <template #body>
        <div class="space-y-4">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-base font-semibold text-default">{{ targetLevel?.name || '-' }}</span>
            <UBadge :label="priceText(targetLevel?.price)" color="primary" variant="soft" size="sm" />
            <UBadge :label="durationText(targetLevel ?? {})" color="neutral" variant="soft" size="sm" />
          </div>

          <!-- 待支付：二维码 / 支付链接 -->
          <template v-if="currentOrder && currentStatus === 'WP'">
            <div class="flex flex-col items-center gap-2">
              <img
                v-if="currentOrder.qrImageUrl"
                :src="currentOrder.qrImageUrl"
                alt="member level qrcode"
                class="max-w-[220px] rounded-md border border-default bg-white p-1"
              >
              <template v-else-if="currentOrder.qrContent">
                <UTextarea
                  :model-value="currentOrder.qrContent"
                  readonly
                  autoresize
                  :rows="2"
                  color="neutral"
                  variant="subtle"
                  class="w-full font-mono text-xs"
                />
                <div class="text-xs text-muted">{{ $ts('module.system.wallet.qrContentTip') }}</div>
              </template>
              <div v-else class="text-xs text-muted">{{ $ts('module.system.wallet.noQrcode') }}</div>

              <UButton
                v-if="currentOrder.payUrl"
                :to="currentOrder.payUrl"
                target="_blank"
                size="sm"
                variant="link"
                icon="i-lucide-external-link"
              >
                {{ $ts('module.system.wallet.openPayUrl') }}
              </UButton>
            </div>

            <div class="flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
              <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border" :class="currentStatusClass">
                {{ statusBadge(currentStatus).label }}
              </span>
              <span v-if="polling" class="inline-flex items-center gap-1">
                <UIcon name="i-lucide-loader-circle" class="animate-spin" />
                {{ $ts('module.system.wallet.polling') }}
              </span>
            </div>

            <div class="text-center text-xs text-muted">
              {{ $ts('module.system.profile.memberOrderNo') }}：<span class="break-all">{{ currentOrder.outTradeNo }}</span>
            </div>
            <div class="text-center text-xs text-muted">
              {{ $ts('module.system.profile.memberOrderAmount') }}：{{ currentOrder.payAmount || '-' }}
            </div>
          </template>

          <!-- 终结态：只给结果与原因 -->
          <UAlert
            v-else-if="currentOrder"
            :color="currentTerminalAlert.color"
            variant="subtle"
            :icon="currentTerminalAlert.icon"
            :title="currentTerminalAlert.title"
            :description="currentTerminalReason || currentTerminalAlert.description"
          />

          <!-- 选择支付方式 -->
          <template v-else>
            <UAlert
              v-if="isFreeTarget"
              color="success"
              variant="soft"
              icon="i-lucide-gift"
              :title="$ts('module.system.profile.memberFreeTitle')"
              :description="$ts('module.system.profile.memberFreeDesc')"
            />
            <UFormField v-else name="payMode" :label="$ts('module.system.profile.memberPayMode')">
              <URadioGroup v-model="payMode" :items="payModeItems" orientation="horizontal" />
            </UFormField>

            <p v-if="!isFreeTarget" class="text-xs text-muted">{{ $ts('module.system.profile.memberPayModeTip') }}</p>
          </template>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="subtle"
            :label="currentOrder ? $ts('common.close') : $ts('common.cancel')"
            @click="closeDialog"
          />
          <UButton
            v-if="!currentOrder"
            color="primary"
            :loading="submitting"
            :label="isFreeTarget ? $ts('module.system.profile.memberFreeOpen') : $ts('module.system.profile.memberSubmit')"
            @click="submitOpenLevel"
          />
          <UButton
            v-else-if="currentStatus === 'WP'"
            variant="outline"
            color="neutral"
            icon="i-lucide-refresh-cw"
            :loading="syncing"
            :label="$ts('module.system.wallet.syncNow')"
            @click="syncOrderStatus"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
