<template>
  <div class="h-full p-3 space-y-3">
    <!-- 余额总览：双账 + 冻结 + 可用 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <UCard :ui="{ body: 'p-4' }">
        <div class="text-xs text-muted">{{ $ts('module.system.wallet.rechargeBalance') }}</div>
        <div class="mt-1 text-2xl font-semibold">{{ wallet.availableRecharge }}</div>
        <div class="mt-1 text-xs text-muted">
          {{ $ts('module.system.wallet.balanceDetail', { balance: wallet.rechargeBalance, frozen: wallet.frozenRecharge }) }}
        </div>
      </UCard>
      <UCard :ui="{ body: 'p-4' }">
        <div class="text-xs text-muted">{{ $ts('module.system.wallet.giftBalance') }}</div>
        <div class="mt-1 text-2xl font-semibold">{{ wallet.availableGift }}</div>
        <div class="mt-1 text-xs text-muted">
          {{ $ts('module.system.wallet.balanceDetail', { balance: wallet.giftBalance, frozen: wallet.frozenGift }) }}
        </div>
      </UCard>
      <UCard :ui="{ body: 'p-4' }">
        <div class="text-xs text-muted">{{ $ts('module.system.wallet.availableTotal') }}</div>
        <div class="mt-1 text-2xl font-semibold">{{ wallet.availableTotal }}</div>
        <div class="mt-1 text-xs text-muted">
          {{ $ts('module.system.wallet.totalConsume') }}：{{ wallet.totalConsume }}
        </div>
      </UCard>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <!-- 充值 -->
      <UCard :ui="{ body: 'space-y-4' }">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-hand-coins" />
            <span>{{ $ts('module.system.wallet.rechargeTitle') }}</span>
          </div>
        </template>

        <UForm :state="rechargeForm" class="space-y-4" @submit="handleRecharge">
          <UFormField name="amount" required :label="$ts('module.system.wallet.amount')">
            <UInput
              v-model="rechargeForm.amount"
              type="number"
              step="0.01"
              min="0.01"
              :placeholder="$ts('module.system.wallet.form.amount')"
              class="w-full"
              @blur="() => void recheckCouponOnAmountChange()"
            />
          </UFormField>
          <UFormField name="couponCode" :label="$ts('module.system.wallet.couponCode')">
            <UBaseInput
              v-model="rechargeForm.couponCode"
              :placeholder="$ts('module.system.wallet.form.couponCode')"
              trailing="clear"
              class="w-full"
              @blur="() => void checkCoupon()"
            />
            <template #help>
              <span v-if="couponChecking" class="inline-flex items-center gap-1 text-muted">
                <UIcon name="i-lucide-loader-circle" class="animate-spin" />
                {{ $ts('module.system.wallet.couponChecking') }}
              </span>
              <span v-else-if="couponCheck?.valid" class="text-success">{{ couponHintText }}</span>
              <span v-else-if="couponCheck && !couponCheck.valid" class="text-error">
                {{ couponInvalidText }}
              </span>
              <span v-else class="text-muted">{{ $ts('module.system.wallet.couponCodeHelp') }}</span>
            </template>
          </UFormField>
          <div class="flex justify-end">
            <UButton type="submit" color="primary" icon="i-lucide-qr-code" :loading="creating" :disabled="!canSubmitRecharge">
              {{ $ts('module.system.wallet.submitRecharge') }}
            </UButton>
          </div>
        </UForm>

        <USeparator v-if="current" :label="$ts('module.system.wallet.currentRecharge')" />

        <div v-if="current" class="flex flex-col items-center gap-2">
          <!-- 待支付：展示二维码 / 支付链接 -->
          <template v-if="currentStatus === 'WP'">
            <img
              v-if="current.qrImageUrl"
              :src="current.qrImageUrl"
              alt="recharge qrcode"
              class="max-w-[220px] rounded-md border border-default bg-white p-1"
            >
            <template v-else-if="current.qrContent">
              <UTextarea
                :model-value="current.qrContent"
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
              v-if="current.payUrl"
              :to="current.payUrl"
              target="_blank"
              size="sm"
              variant="link"
              icon="i-lucide-external-link"
            >
              {{ $ts('module.system.wallet.openPayUrl') }}
            </UButton>
          </template>

          <!-- 已终结（到账 / 被关闭 / 失败）：不再展示二维码，只给结果与原因 -->
          <UAlert
            v-else
            class="w-full max-w-md"
            :color="currentTerminalAlert.color"
            variant="subtle"
            :icon="currentTerminalAlert.icon"
            :title="currentTerminalAlert.title"
            :description="currentTerminalReason || currentTerminalAlert.description"
          />

          <div class="text-xs text-muted">
            {{ $ts('module.system.wallet.rechargeOrderNo') }}：<span class="break-all">{{ current.outTradeNo }}</span>
          </div>
          <div class="text-xs text-muted">
            {{ $ts('module.system.wallet.payAmount') }}：{{ current.payAmount }}
            <span v-if="current.giftAmount && current.giftAmount !== '0.00'">
              （{{ $ts('module.system.wallet.giftAmount') }} {{ current.giftAmount }}）
            </span>
          </div>

          <div class="flex items-center gap-2">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border" :class="currentStatusClass">
              {{ statusLabel(currentStatus) }}
            </span>
            <span v-if="polling" class="text-xs text-muted inline-flex items-center gap-1">
              <UIcon name="i-lucide-loader-circle" class="animate-spin" />
              {{ $ts('module.system.wallet.polling') }}
            </span>
          </div>

          <UButton
            v-if="currentStatus === 'WP'"
            size="xs"
            variant="outline"
            color="neutral"
            icon="i-lucide-refresh-cw"
            :loading="syncing"
            @click="syncRecharge"
          >
            {{ $ts('module.system.wallet.syncNow') }}
          </UButton>
        </div>
      </UCard>

      <!-- 我的邀请 -->
      <UCard :ui="{ body: 'space-y-3' }">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-share-2" />
            <span>{{ $ts('module.system.wallet.myInvite') }}</span>
          </div>
        </template>

        <div class="flex items-center gap-2">
          <span class="text-sm text-muted">{{ $ts('module.system.wallet.inviteCode') }}</span>
          <UBadge color="primary" variant="subtle">
            {{ profile.inviteCode || '-' }}
          </UBadge>
          <UButton
            v-if="profile.inviteCode"
            size="xs"
            variant="outline"
            icon="i-lucide-copy"
            @click="copyInviteCode"
          >
            {{ $ts('common.copy') }}
          </UButton>
        </div>

        <div class="text-sm text-muted">
          {{ $ts('module.system.wallet.inviteeCount') }}：{{ inviteeCount }}
        </div>

        <div v-if="invitees.length === 0" class="py-4 text-center text-sm text-muted">
          {{ $ts('module.system.wallet.noInvitees') }}
        </div>
        <div v-else class="max-h-56 overflow-auto space-y-2">
          <div
            v-for="item in invitees"
            :key="String(item.userId ?? '')"
            class="rounded-md border border-default p-2 text-xs flex flex-wrap gap-3"
          >
            <span>{{ item.nickname || item.username || item.userId }}</span>
            <span class="text-muted">{{ item.createdAt }}</span>
          </div>
        </div>
      </UCard>
    </div>

    <!-- 明细区：流水 / 充值记录 / 我的优惠码 -->
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <UTabs :items="tabItems" :ui="{ list: 'px-4 pt-2' }">
        <template #logs>
          <UTable :data="logs" :columns="logColumns" :loading="logsLoading" class="w-full" />
          <div class="flex justify-end px-4 py-2">
            <UPagination
              v-model:page="logPage"
              :total="logTotal"
              :items-per-page="logPageSize"
              @update:page="loadLogs"
            />
          </div>
        </template>

        <template #recharges>
          <UTable :data="rechargeList" :columns="rechargeColumns" :loading="rechargesLoading" class="w-full" />
        </template>

        <template #coupons>
          <UTable :data="couponUses" :columns="couponColumns" :loading="couponsLoading" class="w-full" />
        </template>
      </UTabs>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '我的余额',
  icon: 'i-lucide-wallet'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysMemberCouponCheckRespDTO } from '#shared/system/member'
import { memberAccountRecord, memberBizTypeRecord, memberCouponUseStatusConfig, memberDirectionRecord, memberRechargeStatusConfig } from '#shared/constants/business'
import { badgeColorClasses } from '~/composables/badgeColorClasses'
import { useToastError, useToastSuccess, useToastWarning } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
// 会员档案（邀请码 / 下级数量）走会话级 store：与个人中心共用一次请求
const memberProfileStore = useMemberProfileStore()

const wallet = ref({
  rechargeBalance: '0.00',
  giftBalance: '0.00',
  frozenRecharge: '0.00',
  frozenGift: '0.00',
  availableRecharge: '0.00',
  availableGift: '0.00',
  availableTotal: '0.00',
  totalRecharge: '0.00',
  totalGift: '0.00',
  totalConsume: '0.00'
})

const profile = ref<{ inviteCode?: string | null }>({})
/** 下级数量：取 myProfile 的 inviteeCount（服务端 COUNT），不再用明细列表长度代替 */
const inviteeCount = ref(0)
/**
 * 下级明细：页面上确实渲染了明细列表，因此 `sysMember.myInvitees` 必须保留；
 * 它只服务于列表，数量展示不再依赖它。
 */
const invitees = ref<Array<{ userId?: string | null, nickname?: string | null, username?: string | null, createdAt?: string | null }>>([])
const logs = ref<Array<Record<string, unknown>>>([])
const logsLoading = ref(false)
const logPage = ref(1)
const logPageSize = 10
const logTotal = ref(0)
const rechargeList = ref<Array<Record<string, unknown>>>([])
const rechargesLoading = ref(false)
const couponUses = ref<Array<Record<string, unknown>>>([])
const couponsLoading = ref(false)

const rechargeForm = reactive<{
  /**
   * 声明为 string 以满足 `UInput` 的绑定类型；但 `type="number"` 在运行时可能给出
   * number，因此判空与提交一律经 `toText()`（历史上这里直接 `.trim()` 抛过 TypeError）。
   */
  amount: string
  couponCode: string
}>({ amount: '', couponCode: '' })

/** 统一转成字符串：数字型输入没有 `.trim()`（历史上这里抛过 TypeError） */
const toText = (value: string | number | null | undefined) => String(value ?? '').trim()

/** 优惠码校验结果（null = 未填或尚未校验） */
const couponCheck = ref<SysMemberCouponCheckRespDTO | null>(null)
const couponChecking = ref(false)

const resetCouponCheck = () => {
  couponCheck.value = null
}

/**
 * 主动校验优惠码：填了码就查一次，返回是否可用。
 * 未填金额时只校验券本身（门槛/抵扣等填了金额再算），
 * 真正下单时服务端还会用同一套规则再校验一次。
 */
const checkCoupon = async (): Promise<boolean> => {
  const code = toText(rechargeForm.couponCode)

  if (!code) {
    resetCouponCheck()

    return true
  }

  couponChecking.value = true

  try {
    couponCheck.value = await $trpc.sysMember.myCouponCheck.query({
      code,
      amount: toText(rechargeForm.amount) || null
    })

    return couponCheck.value.valid
  } finally {
    couponChecking.value = false
  }
}

/** 金额变化会让「门槛 / 抵扣额」失效，需要重新校验 */
const recheckCouponOnAmountChange = async () => {
  if (!toText(rechargeForm.couponCode)) {
    return
  }

  await checkCoupon()
}

const canSubmitRecharge = computed(() => Boolean(toText(rechargeForm.amount)) && !couponChecking.value && !creating.value)

/** 优惠码校验通过后的提示文案：填了金额显示抵扣/应付，否则提示门槛 */
const couponHintText = computed(() => {
  const result = couponCheck.value

  if (!result?.valid) {
    return ''
  }

  if (result.discountAmount) {
    // 后缀整段走 i18n：括号与语序在不同语言里不一样，不要硬编码中文括号
    const gift = result.giftAmount && result.giftAmount !== '0.00'
      ? $ts('module.system.wallet.couponGiftSuffix', { gift: result.giftAmount })
      : ''

    return $ts('module.system.wallet.couponValid', {
      discount: result.discountAmount,
      payable: result.payableAmount ?? '-',
      gift
    })
  }

  return $ts('module.system.wallet.couponMinAmountTip', { amount: result.minAmount ?? '0.00' })
})

/** 校验失败文案：金额相关的两类错误要把金额作为参数传给 i18n */
const couponInvalidText = computed(() => {
  const reason = couponCheck.value?.reason || 'module.system.member.couponNotFound'

  if (reason === 'module.system.member.couponMinAmount') {
    return $ts(reason, { message: couponCheck.value?.minAmount ?? '-' })
  }

  // 面值大于本次金额：提示「需满足 ¥X 才可使用」
  if (reason === 'module.system.member.couponNotApplicable') {
    return $ts(reason, { message: couponCheck.value?.requiredAmount ?? '-' })
  }

  return $ts(reason)
})
const creating = ref(false)
const syncing = ref(false)
const polling = ref(false)
const current = ref<{
  outTradeNo: string
  qrImageUrl?: string | null
  qrContent?: string | null
  payUrl?: string | null
  payAmount: string
  giftAmount: string
} | null>(null)
const currentStatus = ref('WP')
/** 单据终结时的原因（关闭原因 / 失败原因），用于「被后台关闭」这类场景的明确提示 */
const currentTerminalReason = ref<string | null>(null)

/** 状态徽标配色：跟随充值单状态配置（WP 待支付 / OD 已到账 / CL 已关闭 / FL 失败） */
const currentStatusClass = computed(() => {
  const color = memberRechargeStatusConfig[currentStatus.value]?.color ?? 'neutral'

  return badgeColorClasses[color] || badgeColorClasses.neutral
})

/** 单据终结后的结果提示（待支付时不展示，二维码区域取而代之） */
const currentTerminalAlert = computed(() => {
  if (currentStatus.value === 'OD') {
    return {
      color: 'success' as const,
      icon: 'i-lucide-circle-check',
      title: $ts('module.system.wallet.rechargeSuccess'),
      description: $ts('module.system.wallet.rechargeSuccessDesc')
    }
  }

  if (currentStatus.value === 'CL') {
    return {
      color: 'warning' as const,
      icon: 'i-lucide-circle-slash',
      title: $ts('module.system.wallet.rechargeClosed'),
      description: $ts('module.system.wallet.rechargeClosedDesc')
    }
  }

  return {
    color: 'error' as const,
    icon: 'i-lucide-triangle-alert',
    title: $ts('module.system.wallet.rechargeFailed'),
    description: $ts('module.system.wallet.rechargeFailedDesc')
  }
})

let pollTimer: ReturnType<typeof setTimeout> | null = null
let pollStartedAt = 0
let pollFailures = 0
const POLL_INTERVAL = 5000
const POLL_TIMEOUT = 10 * 60 * 1000

const tabItems = computed(() => [
  { label: $ts('module.system.wallet.tabLogs'), slot: 'logs' as const },
  { label: $ts('module.system.wallet.tabRecharges'), slot: 'recharges' as const },
  { label: $ts('module.system.wallet.tabCoupons'), slot: 'coupons' as const }
])

const translate = (record: Record<string, string>, value?: string | null) => {
  if (!value) return '-'
  const key = record[value]

  return key ? $ts(key) : value
}

const statusLabel = (status?: string | null) => {
  const item = status ? memberRechargeStatusConfig[status] : undefined

  return item ? $ts(item.i18nKey) : (status || '-')
}

const badgeCell = (config: Readonly<Record<string, { i18nKey: string, color: string }>>, value?: string | null) => {
  const item = value ? config[value] : undefined
  const label = item ? $ts(item.i18nKey) : (value || '-')
  const cls = item ? badgeColorClasses[item.color] || badgeColorClasses.neutral : badgeColorClasses.neutral

  return h('span', { class: `inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${cls}` }, label)
}

const loadWallet = async () => {
  const result = await $trpc.sysMember.myWallet.query()

  wallet.value = {
    rechargeBalance: result.rechargeBalance,
    giftBalance: result.giftBalance,
    frozenRecharge: result.frozenRecharge,
    frozenGift: result.frozenGift,
    availableRecharge: result.availableRecharge,
    availableGift: result.availableGift,
    availableTotal: result.availableTotal,
    totalRecharge: result.totalRecharge,
    totalGift: result.totalGift,
    totalConsume: result.totalConsume
  }
}

const loadProfile = async () => {
  // 档案走 store（ensure：有缓存直接复用）；明细列表单独请求，只用于下方列表渲染
  const [result, list] = await Promise.all([
    memberProfileStore.ensure(),
    $trpc.sysMember.myInvitees.query()
  ])

  profile.value = { inviteCode: result?.member?.inviteCode ?? null }
  inviteeCount.value = result?.inviteeCount ?? 0
  invitees.value = list as typeof invitees.value
}

const loadLogs = async () => {
  logsLoading.value = true

  try {
    const result = await $trpc.sysMember.myLogs.query({ page: logPage.value, pageSize: logPageSize })

    logs.value = (result.list ?? []) as Array<Record<string, unknown>>
    logTotal.value = result.total ?? 0
  } finally {
    logsLoading.value = false
  }
}

const loadRecharges = async () => {
  rechargesLoading.value = true

  try {
    rechargeList.value = await $trpc.sysMember.myRecharges.query() as Array<Record<string, unknown>>
  } finally {
    rechargesLoading.value = false
  }
}

const loadCoupons = async () => {
  couponsLoading.value = true

  try {
    couponUses.value = await $trpc.sysMember.myCoupons.query() as Array<Record<string, unknown>>
  } finally {
    couponsLoading.value = false
  }
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
    if (!current.value) {
      stopPolling()
      return
    }

    if (Date.now() - pollStartedAt > POLL_TIMEOUT) {
      stopPolling()
      useToastError($ts('module.system.wallet.pollTimeout'))
      return
    }

    try {
      await syncRecharge()
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
  pollFailures = 0
  scheduleNextPoll()
}

/** 主动同步充值状态：已支付则到账；被后台关闭 / 失败则停止轮询并展示原因 */
const syncRecharge = async () => {
  if (!current.value) return

  syncing.value = true

  try {
    const result = await $trpc.sysMember.myRechargeSync.mutate({ outTradeNo: current.value.outTradeNo })

    currentStatus.value = result.status
    currentTerminalReason.value = result.failReason ?? null

    if (result.status === 'OD') {
      stopPolling()
      useToastSuccess($ts('module.system.wallet.rechargeSuccess'), undefined, current.value.payAmount)
      await Promise.all([loadWallet(), loadRecharges(), loadLogs()])

      return
    }

    if (result.status !== 'WP') {
      // 本地单据已终结（后台关闭 / 发起失败）：停止轮询、刷新列表并明确告知原因
      stopPolling()
      await loadRecharges()
      useToastWarning(
        result.status === 'CL'
          ? $ts('module.system.wallet.rechargeClosed')
          : $ts('module.system.wallet.rechargeFailed'),
        undefined,
        result.failReason ?? undefined
      )
    }
  } finally {
    syncing.value = false
  }
}

const handleRecharge = async () => {
  const amountText = toText(rechargeForm.amount)

  if (!amountText) {
    return
  }

  // 生成前主动校验优惠码：无效就直接拦下，不浪费一次「下单 + 渠道请求」
  if (!(await checkCoupon())) {
    useToastError($ts('module.system.wallet.couponInvalid'))
    return
  }

  creating.value = true
  stopPolling()

  try {
    const result = await $trpc.sysMember.myRecharge.mutate({
      amount: amountText,
      couponCode: toText(rechargeForm.couponCode) || null,
      notifyUrl: null
    })

    current.value = {
      outTradeNo: result.outTradeNo,
      qrImageUrl: result.qrImageUrl,
      qrContent: result.qrContent,
      payUrl: result.payUrl,
      payAmount: result.payAmount,
      giftAmount: result.giftAmount
    }
    currentStatus.value = result.status
    currentTerminalReason.value = null
    rechargeForm.amount = ''
    rechargeForm.couponCode = ''
    resetCouponCheck()

    // 只有待支付才需要轮询；已经是终结状态（到账/关闭/失败）就直接停掉
    if (result.status === 'WP') {
      startPolling()
    } else {
      stopPolling()
    }
  } finally {
    creating.value = false
  }
}

const copyInviteCode = async () => {
  if (!profile.value.inviteCode) return

  try {
    await navigator.clipboard.writeText(profile.value.inviteCode)
    useToastSuccess($ts('common.copySuccess'))
  } catch {
    useToastError($ts('module.system.wallet.copyFailed'))
  }
}

const logColumns = computed<TableColumn<Record<string, unknown>>[]>(() => [
  { accessorKey: 'createdAt', header: () => $ts('module.system.wallet.logTime') },
  { id: 'account', header: () => $ts('module.system.wallet.account'), cell: ({ row }) => translate(memberAccountRecord, row.original.account as string) },
  { id: 'direction', header: () => $ts('module.system.wallet.direction'), cell: ({ row }) => translate(memberDirectionRecord, row.original.direction as string) },
  { accessorKey: 'amount', header: () => $ts('module.system.wallet.amount') },
  { id: 'bizType', header: () => $ts('module.system.wallet.bizType'), cell: ({ row }) => translate(memberBizTypeRecord, row.original.bizType as string) },
  { accessorKey: 'bizNo', header: () => $ts('module.system.wallet.bizNo') }
])

const rechargeColumns = computed<TableColumn<Record<string, unknown>>[]>(() => [
  { accessorKey: 'outTradeNo', header: () => $ts('module.system.wallet.rechargeOrderNo') },
  { accessorKey: 'amount', header: () => $ts('module.system.wallet.amount') },
  { accessorKey: 'payAmount', header: () => $ts('module.system.wallet.payAmount') },
  { accessorKey: 'giftAmount', header: () => $ts('module.system.wallet.giftAmount') },
  { id: 'status', header: () => $ts('module.system.wallet.status'), cell: ({ row }) => badgeCell(memberRechargeStatusConfig, row.original.status as string) },
  { accessorKey: 'creditedAt', header: () => $ts('module.system.wallet.creditedAt') },
  { accessorKey: 'createdAt', header: () => $ts('module.system.wallet.logTime') }
])

const couponColumns = computed<TableColumn<Record<string, unknown>>[]>(() => [
  { accessorKey: 'couponCode', header: () => $ts('module.system.wallet.couponCode') },
  { accessorKey: 'discountAmount', header: () => $ts('module.system.wallet.discountAmount') },
  { accessorKey: 'bizNo', header: () => $ts('module.system.wallet.bizNo') },
  { id: 'status', header: () => $ts('module.system.wallet.status'), cell: ({ row }) => badgeCell(memberCouponUseStatusConfig, row.original.status as string) },
  { accessorKey: 'createdAt', header: () => $ts('module.system.wallet.logTime') }
])

onMounted(async () => {
  await Promise.all([loadWallet(), loadProfile(), loadLogs(), loadRecharges(), loadCoupons()])
})

onBeforeUnmount(stopPolling)
</script>
