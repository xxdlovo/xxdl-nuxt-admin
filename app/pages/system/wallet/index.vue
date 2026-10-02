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
            <UInput v-model="rechargeForm.amount" type="number" step="0.01" min="0.01" :placeholder="$ts('module.system.wallet.form.amount')" class="w-full" />
          </UFormField>
          <UFormField name="couponCode" :label="$ts('module.system.wallet.couponCode')" :help="$ts('module.system.wallet.couponCodeHelp')">
            <UBaseInput v-model="rechargeForm.couponCode" :placeholder="$ts('module.system.wallet.form.couponCode')" trailing="clear" class="w-full" />
          </UFormField>
          <div class="flex justify-end">
            <UButton type="submit" color="primary" icon="i-lucide-qr-code" :loading="creating">
              {{ $ts('module.system.wallet.submitRecharge') }}
            </UButton>
          </div>
        </UForm>

        <USeparator v-if="current" :label="$ts('module.system.wallet.currentRecharge')" />

        <div v-if="current" class="flex flex-col items-center gap-2">
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
            <UBadge :color="currentStatus === 'OD' ? 'success' : 'warning'" variant="subtle">
              {{ statusLabel(currentStatus) }}
            </UBadge>
            <span v-if="polling" class="text-xs text-muted inline-flex items-center gap-1">
              <UIcon name="i-lucide-loader-circle" class="animate-spin" />
              {{ $ts('module.system.wallet.polling') }}
            </span>
          </div>

          <UButton
            v-if="currentStatus !== 'OD'"
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
          {{ $ts('module.system.wallet.inviteeCount') }}：{{ invitees.length }}
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
import { memberAccountRecord, memberBizTypeRecord, memberCouponUseStatusConfig, memberDirectionRecord, memberRechargeStatusConfig } from '#shared/constants/business'
import { badgeColorClasses } from '~/composables/badgeColorClasses'
import { useToastError, useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

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

const rechargeForm = reactive({ amount: '', couponCode: '' })
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
  const result = await $trpc.sysMember.myProfile.query()

  profile.value = { inviteCode: result.member?.inviteCode ?? null }
  invitees.value = await $trpc.sysMember.myInvitees.query() as typeof invitees.value
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

/** 主动同步充值状态：已支付则到账并刷新余额 */
const syncRecharge = async () => {
  if (!current.value) return

  syncing.value = true

  try {
    const result = await $trpc.sysMember.myRechargeSync.mutate({ outTradeNo: current.value.outTradeNo })

    currentStatus.value = result.status

    if (result.status === 'OD') {
      stopPolling()
      useToastSuccess($ts('module.system.wallet.rechargeSuccess'), undefined, current.value.payAmount)
      await Promise.all([loadWallet(), loadRecharges(), loadLogs()])
    }
  } finally {
    syncing.value = false
  }
}

const handleRecharge = async () => {
  if (!rechargeForm.amount.trim()) {
    return
  }

  creating.value = true
  stopPolling()

  try {
    const result = await $trpc.sysMember.myRecharge.mutate({
      amount: rechargeForm.amount.trim(),
      couponCode: rechargeForm.couponCode.trim() || null,
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
    rechargeForm.amount = ''
    rechargeForm.couponCode = ''
    startPolling()
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
