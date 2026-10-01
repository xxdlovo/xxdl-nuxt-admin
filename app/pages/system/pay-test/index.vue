<template>
  <div class="h-full p-3">
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <UCard :ui="{ body: 'space-y-4' }">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-qr-code" />
            <span>{{ $ts('module.system.payTest.title') }}</span>
          </div>
        </template>

        <UAlert
          v-if="channels.length === 0"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="$ts('module.system.payTest.noChannel')"
          :description="$ts('module.system.payTest.noChannelTip')"
        />

        <UAlert
          v-else-if="!canCreate"
          color="warning"
          variant="subtle"
          icon="i-lucide-lock"
          :title="$ts('auth.forbidden')"
        />

        <UForm v-else :state="form" class="space-y-4" @submit="handleCreate">
          <UFormField name="channelId" :label="$ts('module.system.payTest.channel')" orientation="horizontal" :ui="formItemUi">
            <USelect v-model="channelValue" :items="channelItems" class="w-full" />
          </UFormField>
          <UFormField name="amount" required :label="$ts('module.system.payTest.amount')" orientation="horizontal" :ui="formItemUi">
            <UInputNumber v-model="form.amount" :min="0.01" :max="99999999.99" :step="0.01" :format-options="{ minimumFractionDigits: 2 }" class="w-full" />
          </UFormField>
          <UFormField name="subject" required :label="$ts('module.system.payTest.subject')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="form.subject" :placeholder="$ts('module.system.payTest.form.subject')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="attach" :label="$ts('module.system.payTest.attach')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="form.attach" :placeholder="$ts('module.system.payTest.form.attach')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="notifyUrl" :label="$ts('module.system.payTest.notifyUrl')" orientation="horizontal" :ui="formItemUi" :help="$ts('module.system.payTest.notifyUrlHelp')">
            <UBaseInput v-model="form.notifyUrl" :placeholder="$ts('module.system.payTest.form.notifyUrl')" trailing="clear" class="w-full" />
          </UFormField>

          <div class="flex justify-end gap-2">
            <UButton type="submit" color="primary" icon="i-lucide-qr-code" :loading="creating" :disabled="!canCreate">
              {{ $ts('module.system.payTest.submit') }}
            </UButton>
          </div>
        </UForm>
      </UCard>

      <UCard :ui="{ body: 'space-y-4' }">
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-receipt-text" />
              <span>{{ $ts('module.system.payTest.resultTitle') }}</span>
            </div>
            <span v-if="polling" class="text-xs text-muted inline-flex items-center gap-1">
              <UIcon name="i-lucide-loader-circle" class="animate-spin" />
              {{ $ts('module.system.payTest.polling') }}
            </span>
          </div>
        </template>

        <div v-if="!order" class="py-10 text-center text-sm text-muted">
          {{ $ts('module.system.payTest.emptyResult') }}
        </div>

        <template v-else>
          <div class="flex flex-wrap items-center gap-3">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border" :class="statusBadge.class">
              {{ statusBadge.label }}
            </span>
            <span class="text-xs text-muted">{{ order.channelName || order.channelCode }}</span>
            <span class="text-xs text-muted">{{ order.providerStatus || '-' }}</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <UFormField :label="$ts('module.system.payTest.outTradeNo')" orientation="horizontal" :ui="detailItemUi">
              <UInput :model-value="order.outTradeNo" readonly color="neutral" variant="subtle" class="w-full" :ui="{ base: 'break-all' }" />
            </UFormField>
            <UFormField :label="$ts('module.system.payTest.amount')" orientation="horizontal" :ui="detailItemUi">
              <UInput :model-value="`${order.amount} ${order.currency}`" readonly color="neutral" variant="subtle" class="w-full" />
            </UFormField>
            <UFormField :label="$ts('module.system.payTest.subject')" orientation="horizontal" :ui="detailItemUi">
              <UInput :model-value="order.subject" readonly color="neutral" variant="subtle" class="w-full" :ui="{ base: 'break-all' }" />
            </UFormField>
            <UFormField :label="$ts('module.system.payTest.expireAt')" orientation="horizontal" :ui="detailItemUi">
              <UInput :model-value="order.expireAt || '-'" readonly color="neutral" variant="subtle" class="w-full" />
            </UFormField>
            <UFormField :label="$ts('module.system.payTest.paidAt')" orientation="horizontal" :ui="detailItemUi">
              <UInput :model-value="order.paidAt || '-'" readonly color="neutral" variant="subtle" class="w-full" />
            </UFormField>
            <UFormField :label="$ts('module.system.payTest.notifyCount')" orientation="horizontal" :ui="detailItemUi">
              <UInput :model-value="String(order.notifyCount ?? 0)" readonly color="neutral" variant="subtle" class="w-full" />
            </UFormField>
          </div>

          <UAlert
            v-if="notifyUrlWarning"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="$ts('module.system.payTest.notifyUrlWarning')"
            :description="order.notifyUrl || ''"
          />
          <div v-else class="text-xs text-muted break-all">
            {{ $ts('module.system.payTest.notifyUrl') }}: {{ order.notifyUrl || '-' }}
          </div>

          <div class="flex flex-col items-center gap-2">
            <img
              v-if="order.qrImageUrl"
              :src="order.qrImageUrl"
              alt="pay qrcode"
              class="max-w-[240px] rounded-md border border-default"
            >
            <template v-else-if="order.qrContent">
              <UTextarea
                :model-value="order.qrContent"
                readonly
                autoresize
                :rows="2"
                color="neutral"
                variant="subtle"
                class="w-full font-mono text-xs"
              />
              <div class="text-xs text-muted">{{ $ts('module.system.payTest.qrContentTip') }}</div>
              <UButton size="xs" variant="outline" icon="i-lucide-copy" @click="copyQrContent">
                {{ $ts('common.copy') }}
              </UButton>
            </template>
            <div v-else class="text-xs text-muted">{{ $ts('module.system.payTest.noQrcode') }}</div>

            <UButton
              v-if="order.payUrl"
              :to="order.payUrl"
              target="_blank"
              size="sm"
              variant="link"
              icon="i-lucide-external-link"
            >
              {{ $ts('module.system.payTest.openPayUrl') }}
            </UButton>
          </div>

          <div class="flex flex-wrap justify-end gap-2">
            <UButton
              variant="outline"
              color="neutral"
              icon="i-lucide-refresh-cw"
              :loading="syncing"
              :disabled="!canQuery"
              @click="handleSync"
            >
              {{ $ts('module.system.payTest.syncStatus') }}
            </UButton>
            <UButton
              variant="outline"
              color="success"
              icon="i-lucide-circle-check"
              :loading="simulating"
              :disabled="!canSimulate || !order.simulateEnabled || !order.simulateSupported || order.status === 'OD'"
              @click="handleSimulate"
            >
              {{ $ts('module.system.payTest.simulatePaid') }}
            </UButton>
          </div>

          <div v-if="!order.simulateEnabled" class="text-xs text-muted">
            {{ $ts('module.system.payTest.simulateDisabledTip') }}
          </div>
          <div v-else-if="!order.simulateSupported" class="text-xs text-muted">
            {{ $ts('module.system.payTest.simulateUnsupportedTip') }}
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '扫码支付测试',
  icon: 'i-lucide-qr-code'
})

import type { SysPayTestStatusDTO } from '#shared/system/payTest'
import { payOrderStatusConfig } from '#shared/constants/business'
import { badgeColorClasses } from '~/composables/badgeColorClasses'
import { useToastError, useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const { isAdmin, hasPermission } = useRbacProfile()

const formItemUi = {
  root: 'flex items-center',
  label: 'w-28 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}
const detailItemUi = {
  root: 'items-start',
  labelWrapper: 'w-28 shrink-0 pt-1',
  container: 'min-w-0 flex-1'
}

const canCreate = computed(() => isAdmin.value || hasPermission('system:payTest:create'))
const canQuery = computed(() => isAdmin.value || hasPermission('system:payTest:query'))
const canSimulate = computed(() => isAdmin.value || hasPermission('system:payTest:simulate'))

const channels = ref<Array<{ id: string; configName: string; channelCode: string; currency: string; isDefault: number; notifyUrl: string | null }>>([])
const order = ref<SysPayTestStatusDTO | null>(null)
const creating = ref(false)
const syncing = ref(false)
const simulating = ref(false)
const polling = ref(false)

const form = ref({
  channelId: '',
  amount: 0.01,
  subject: '扫码支付测试',
  attach: '',
  notifyUrl: ''
})

const channelItems = computed(() => channels.value.map(channel => ({
  value: channel.id,
  label: `${channel.configName}（${channel.channelCode} · ${channel.currency}）`
})))

const channelValue = computed({
  get: () => form.value.channelId,
  set: value => form.value.channelId = value
})

const statusBadge = computed(() => {
  const item = order.value?.status ? payOrderStatusConfig[order.value.status] : undefined

  if (!item) {
    return { label: order.value?.status || '-', class: badgeColorClasses.neutral }
  }

  return { label: $ts(item.i18nKey), class: badgeColorClasses[item.color] || badgeColorClasses.neutral }
})

/** 公网可达性提醒：localhost / 内网地址 / http 都收不到平台的异步回调 */
const notifyUrlWarning = computed(() => {
  const url = order.value?.notifyUrl

  if (!url) {
    return true
  }

  if (url.startsWith('http://')) {
    return true
  }

  return /(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|\.local)/i.test(url)
})

const loadChannels = async () => {
  channels.value = await $trpc.sysPayTest.channels.query()
  const preferred = channels.value.find(channel => channel.isDefault) ?? channels.value[0]

  if (preferred && !form.value.channelId) {
    form.value.channelId = preferred.id
  }
}

let timer: ReturnType<typeof setInterval> | null = null
let pollingStartedAt = 0

const stopPolling = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  polling.value = false
}

const refreshStatus = async (silent = true) => {
  if (!order.value?.id) {
    return
  }

  const previousStatus = order.value.status
  const next = await $trpc.sysPayTest.getStatus.query({ id: order.value.id })
  order.value = next

  if (silent && previousStatus !== 'OD' && next.status === 'OD') {
    useToastSuccess($ts('module.system.payTest.paidSuccess'))
    stopPolling()
  }
}

const startPolling = () => {
  stopPolling()
  polling.value = true
  pollingStartedAt = Date.now()

  timer = setInterval(async () => {
    if (!order.value?.id) {
      stopPolling()
      return
    }

    // 二维码有效期有限，超过 10 分钟不再轮询，避免无意义请求
    if (Date.now() - pollingStartedAt > 10 * 60 * 1000) {
      stopPolling()
      return
    }

    try {
      await refreshStatus()
    } catch {
      stopPolling()
    }

    if (order.value?.status !== 'WP') {
      stopPolling()
    }
  }, 3000)
}

const handleCreate = async () => {
  if (!form.value.channelId) {
    useToastError($ts('module.system.payTest.noChannel'))
    return
  }

  creating.value = true
  try {
    order.value = await $trpc.sysPayTest.create.mutate({
      channelId: form.value.channelId,
      amount: form.value.amount,
      subject: form.value.subject,
      attach: form.value.attach || undefined,
      notifyUrl: form.value.notifyUrl || undefined
    })
    useToastSuccess($ts('module.system.payOrder.createSuccess'))
    startPolling()
  } finally {
    creating.value = false
  }
}

const handleSync = async () => {
  if (!order.value?.id) {
    return
  }

  syncing.value = true
  try {
    order.value = await $trpc.sysPayTest.syncStatus.mutate({ id: order.value.id })
    useToastSuccess($ts('module.system.payTest.syncDone'))
  } finally {
    syncing.value = false
  }
}

const handleSimulate = async () => {
  if (!order.value?.id) {
    return
  }

  simulating.value = true
  try {
    const result = await $trpc.sysPayTest.simulatePaid.mutate({ id: order.value.id })
    order.value = result.order
    useToastSuccess($ts('module.system.payTest.simulateDone'), undefined, result.processResult)
    stopPolling()
  } finally {
    simulating.value = false
  }
}

const copyQrContent = async () => {
  if (!order.value?.qrContent) {
    return
  }

  try {
    await navigator.clipboard.writeText(order.value.qrContent)
    useToastSuccess($ts('common.copySuccess'))
  } catch {
    useToastError($ts('module.system.payTest.copyFailed'))
  }
}

onMounted(async () => {
  await loadChannels()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>
