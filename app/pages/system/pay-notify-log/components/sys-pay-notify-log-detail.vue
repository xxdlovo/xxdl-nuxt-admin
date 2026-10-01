<script setup lang="ts">
import type { SysPayNotifyLogDto } from '#shared/system/payNotifyLog'
import { payChannelCodeRecord, payNotifyResultConfig, payNotifySourceRecord } from '#shared/constants/business'
import { badgeColorClasses } from '~/composables/badgeColorClasses'

const props = defineProps<{
  visible: boolean
  data?: SysPayNotifyLogDto | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const { $ts } = useI18n()

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

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

const resultBadge = computed(() => {
  const item = props.data?.processResult ? payNotifyResultConfig[props.data.processResult] : undefined

  if (!item) {
    return { label: props.data?.processResult || '-', class: badgeColorClasses.neutral }
  }

  return { label: $ts(item.i18nKey), class: badgeColorClasses[item.color] || badgeColorClasses.neutral }
})

const detailItems = computed(() => {
  const item = props.data

  return [
    { label: $ts('module.system.payNotifyLog.channelCode'), value: translate(payChannelCodeRecord, item?.channelCode) },
    { label: $ts('module.system.payNotifyLog.sourceLabel'), value: translate(payNotifySourceRecord, item?.source) },
    { label: $ts('module.system.payNotifyLog.outTradeNo'), value: item?.outTradeNo },
    { label: $ts('module.system.payNotifyLog.orderId'), value: item?.orderId },
    { label: $ts('module.system.payNotifyLog.providerOrderId'), value: item?.providerOrderId },
    { label: $ts('module.system.payNotifyLog.transactionId'), value: item?.transactionId },
    { label: $ts('module.system.payNotifyLog.amount'), value: item ? `${item.amount ?? '-'} ${item.currency ?? ''}` : '-' },
    { label: $ts('module.system.payNotifyLog.providerStatus'), value: item?.providerStatus },
    { label: $ts('module.system.payNotifyLog.status'), value: item?.status },
    { label: $ts('module.system.payNotifyLog.signValid'), value: item ? (item.signValid ? $ts('module.system.payNotifyLog.signValidYes') : $ts('module.system.payNotifyLog.signValidNo')) : '-' },
    { label: $ts('module.system.payNotifyLog.dedupKey'), value: item?.dedupKey },
    { label: $ts('module.system.payNotifyLog.clientIp'), value: item?.clientIp },
    { label: $ts('module.system.payNotifyLog.createdAt'), value: item?.createdAt }
  ]
})

const prettyJson = (value: unknown) => {
  if (value == null || value === '') {
    return '-'
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()

    // 表单报文不是 JSON，原样展示即可
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return value
    }

    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2)
    } catch {
      return value
    }
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="$ts('module.system.payNotifyLog.detailTitle')"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[900px]', footer: 'justify-end' }"
  >
    <template #body>
      <div v-if="data" class="space-y-4">
        <div class="flex items-center gap-3">
          <span class="text-sm text-muted">{{ $ts('module.system.payNotifyLog.processResult') }}</span>
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border" :class="resultBadge.class">
            {{ resultBadge.label }}
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

        <UFormField v-if="data.message" :label="$ts('module.system.payNotifyLog.message')">
          <UTextarea
            :model-value="data.message"
            readonly
            autoresize
            :rows="2"
            color="neutral"
            variant="subtle"
            class="w-full text-xs"
          />
        </UFormField>

        <UFormField :label="$ts('module.system.payNotifyLog.rawBody')">
          <UTextarea
            :model-value="prettyJson(data.rawBody)"
            readonly
            autoresize
            :rows="6"
            :maxrows="14"
            color="neutral"
            variant="subtle"
            class="w-full font-mono text-xs"
            :ui="{ base: 'max-h-72 overflow-auto leading-5' }"
          />
        </UFormField>

        <UFormField :label="$ts('module.system.payNotifyLog.rawHeaders')">
          <UTextarea
            :model-value="prettyJson(data.rawHeaders)"
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
      </div>
    </template>

    <template #footer>
      <UButton color="neutral" variant="subtle" @click="visible = false">
        {{ $ts('common.close') }}
      </UButton>
    </template>
  </UModal>
</template>
