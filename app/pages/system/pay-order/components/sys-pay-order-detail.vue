<script setup lang="ts">
import type { SysPayOrderDto } from '#shared/system/payOrder'
import type { SysPayNotifyLogDto } from '#shared/system/payNotifyLog'
import {
  payChannelCodeRecord,
  payModeRecord,
  payNotifyResultConfig,
  payNotifySourceRecord,
  payOrderStatusConfig
} from '#shared/constants/business'
import { badgeColorClasses } from '~/composables/badgeColorClasses'

const props = defineProps<{
  visible: boolean
  data?: SysPayOrderDto | null
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

const logs = ref<SysPayNotifyLogDto[]>([])
const logsLoading = ref(false)

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

/** 状态 / 结论 / 来源的彩色标签 */
const badge = (config: Readonly<Record<string, { i18nKey: string; color: string }>>, value?: string | null) => {
  const item = value ? config[value] : undefined

  if (!item) {
    return { label: value || '-', class: badgeColorClasses.neutral }
  }

  return {
    label: $ts(item.i18nKey),
    class: badgeColorClasses[item.color] || badgeColorClasses.neutral
  }
}

const statusBadge = computed(() => badge(payOrderStatusConfig, props.data?.status))

const detailItems = computed(() => {
  const item = props.data

  return [
    { label: $ts('module.system.payOrder.outTradeNo'), value: item?.outTradeNo },
    { label: $ts('module.system.payOrder.channelCode'), value: translate(payChannelCodeRecord, item?.channelCode) },
    { label: $ts('module.system.payOrder.amount'), value: item ? `${item.amount ?? '-'} ${item.currency ?? ''}` : '-' },
    { label: $ts('module.system.payOrder.payMode'), value: translate(payModeRecord, item?.payMode) },
    { label: $ts('module.system.payOrder.providerStatus'), value: item?.providerStatus },
    { label: $ts('module.system.payOrder.providerOrderId'), value: item?.providerOrderId },
    { label: $ts('module.system.payOrder.transactionId'), value: item?.transactionId },
    { label: $ts('module.system.payOrder.bizType'), value: item?.bizType },
    { label: $ts('module.system.payOrder.subject'), value: item?.subject },
    { label: $ts('module.system.payOrder.attach'), value: item?.attach },
    { label: $ts('module.system.payOrder.notifyUrl'), value: item?.notifyUrl },
    { label: $ts('module.system.payOrder.expireAt'), value: item?.expireAt },
    { label: $ts('module.system.payOrder.paidAt'), value: item?.paidAt },
    { label: $ts('module.system.payOrder.cancelledAt'), value: item?.cancelledAt },
    { label: $ts('module.system.payOrder.lastQueryAt'), value: item?.lastQueryAt },
    { label: $ts('module.system.payOrder.notifyCount'), value: item?.notifyCount },
    { label: $ts('module.system.payOrder.lastNotifyAt'), value: item?.lastNotifyAt },
    { label: $ts('module.system.payOrder.failReason'), value: item?.failReason },
    { label: $ts('module.system.payOrder.clientIp'), value: item?.clientIp },
    { label: $ts('module.system.payOrder.createdAt'), value: item?.createdAt },
    { label: $ts('module.system.payOrder.remark'), value: item?.remark }
  ]
})

const providerDataText = computed(() => {
  if (props.data?.providerData == null) {
    return '-'
  }

  try {
    return JSON.stringify(props.data.providerData, null, 2)
  } catch {
    return String(props.data.providerData)
  }
})

const loadLogs = async () => {
  if (!props.data?.id) {
    logs.value = []
    return
  }

  logsLoading.value = true
  try {
    logs.value = await $trpc.sysPayOrder.notifyLogs.query(props.data.id) as SysPayNotifyLogDto[]
  } finally {
    logsLoading.value = false
  }
}

watch(visible, (opened) => {
  if (opened) {
    void loadLogs()
  }
})
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="$ts('module.system.payOrder.detailTitle')"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[900px]', footer: 'justify-end' }"
  >
    <template #body>
      <div v-if="data" class="space-y-4">
        <div class="flex items-center gap-3">
          <span class="text-sm text-muted">{{ $ts('module.system.payOrder.statusLabel') }}</span>
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border" :class="statusBadge.class">
            {{ statusBadge.label }}
          </span>
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
              <UInput
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

        <UCard v-if="data.qrImageUrl" variant="subtle" :ui="{ body: 'flex flex-col items-center gap-2' }">
          <span class="text-sm text-muted">{{ $ts('module.system.payOrder.qrImageUrl') }}</span>
          <img :src="data.qrImageUrl" alt="pay qrcode" class="max-w-[220px] rounded-md border border-default">
        </UCard>

        <UFormField :label="$ts('module.system.payOrder.providerData')">
          <UTextarea
            :model-value="providerDataText"
            readonly
            autoresize
            :rows="4"
            :maxrows="10"
            color="neutral"
            variant="subtle"
            class="w-full font-mono text-xs"
            :ui="{ base: 'max-h-56 overflow-auto leading-5' }"
          />
        </UFormField>

        <USeparator :label="$ts('module.system.payOrder.notifyTimeline')" />

        <div v-if="logsLoading" class="py-4 text-center text-sm text-muted">
          <UIcon name="i-lucide-loader-circle" class="animate-spin" />
        </div>
        <div v-else-if="logs.length === 0" class="py-4 text-center text-sm text-muted">
          {{ $ts('module.system.payOrder.noNotifyLogs') }}
        </div>
        <div v-else class="space-y-2 max-h-72 overflow-auto pr-1">
          <div
            v-for="log in logs"
            :key="String(log.id ?? log.createdAt ?? '')"
            class="rounded-md border border-default p-3 text-xs space-y-1"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full border" :class="badge(payNotifyResultConfig, log.processResult).class">
                {{ badge(payNotifyResultConfig, log.processResult).label }}
              </span>
              <span class="text-muted">{{ translate(payNotifySourceRecord, log.source) }}</span>
              <span class="text-muted">{{ log.createdAt }}</span>
              <span v-if="log.source !== 'query' && log.source !== 'reconcile'" class="text-muted">
                {{ log.signValid ? $ts('module.system.payNotifyLog.signValidYes') : $ts('module.system.payNotifyLog.signValidNo') }}
              </span>
            </div>
            <div class="text-muted">
              {{ log.providerStatus || '-' }} / {{ log.status || '-' }} / {{ log.amount || '-' }} {{ log.currency || '' }}
            </div>
            <div v-if="log.message" class="break-all">{{ log.message }}</div>
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
