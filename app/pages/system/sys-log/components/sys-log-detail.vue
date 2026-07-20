<script setup lang="ts">
import type { SysLogDto } from '#shared/system/SysLog'
import { useToastSuccess } from '~/utils/toast'

const props = defineProps<{
  visible: boolean
  data?: SysLogDto | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const { $ts } = useI18n()
const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const paramsCompact = ref(false)
const resultCompact = ref(false)

function parseValue(value: unknown) {
  if (typeof value !== 'string') {
    return value
  }

  try {
    return JSON.parse(value)
  }
  catch {
    return value
  }
}

function formatPayload(value: unknown, compact = false) {
  if (value == null || value === '') {
    return '-'
  }

  const parsed = parseValue(value)
  if (typeof parsed === 'string') {
    return parsed
  }

  return JSON.stringify(parsed, null, compact ? 0 : 2)
}

async function copyPayload(value: unknown, compact = false) {
  const text = formatPayload(value, compact)
  if (text === '-') {
    return
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    }
    else {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }

    useToastSuccess($ts('common.copySuccess'))
  }
  catch {
    // Clipboard access can be unavailable in insecure browser contexts.
  }
}

const detailItems = computed(() => {
  const item = props.data

  return [
    { label: $ts('module.system.sysLog.detail.operator'), value: item?.username || item?.userId || '-' },
    { label: $ts('module.system.sysLog.detail.operationTime'), value: item?.createdAt || '-' },
    { label: $ts('module.system.sysLog.detail.requestMethod'), value: item?.requestMethod || '-' },
    { label: $ts('module.system.sysLog.detail.requestPath'), value: item?.requestPath || item?.trpcPath || '-' },
    { label: $ts('module.system.sysLog.detail.ip'), value: item?.ip || '-' },
    { label: $ts('module.system.sysLog.detail.browser'), value: item?.browser || '-' },
    { label: $ts('module.system.sysLog.detail.os'), value: item?.os || '-' },
    { label: $ts('module.system.sysLog.detail.duration'), value: item?.durationMs == null ? '-' : `${item.durationMs}ms` },
    { label: $ts('module.system.sysLog.detail.errorCode'), value: item?.errorCode || '-' },
    { label: $ts('module.system.sysLog.detail.traceId'), value: item?.traceId || '-' },
    { label: $ts('module.system.sysLog.detail.createdBy'), value: item?.createdBy || '-' },
    { label: $ts('module.system.sysLog.detail.updatedAt'), value: item?.updatedAt || '-' }
  ]
})

function displayValue(value: unknown) {
  if (value == null || value === '') {
    return '-'
  }

  return String(value)
}
</script>

<template>
  <UModal v-model:open="visible" :title="$ts('module.system.sysLog.detail.title')" :ui="{ content: 'max-w-[860px]', footer: 'justify-end' }">
    <template #body>
      <UCard
        v-if="data"
        variant="subtle"
        :ui="{ body: 'space-y-4' }"
      >
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          <UFormField
            v-for="item in detailItems"
            :key="item.label"
            :label="item.label"
            orientation="horizontal"
            :ui="{ root: 'items-start', labelWrapper: 'w-24 shrink-0 pt-1', container: 'min-w-0 flex-1' }"
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

        <USeparator />

        <div class="space-y-3">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-medium text-default">
              {{ $ts('module.system.sysLog.detail.requestBody') }}
            </h3>
            <div class="flex gap-1">
              <UButton size="xs" variant="ghost" color="neutral" :label="$ts(paramsCompact ? 'common.format' : 'common.compact')" @click="paramsCompact = !paramsCompact" />
              <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-copy" :label="$ts('common.copy')" @click="copyPayload(data.requestParams, paramsCompact)" />
            </div>
          </div>
          <UTextarea
            :model-value="formatPayload(data.requestParams, paramsCompact)"
            readonly
            autoresize
            :rows="6"
            :maxrows="12"
            color="neutral"
            variant="subtle"
            class="w-full font-mono text-xs"
            :ui="{ base: 'max-h-56 overflow-auto leading-5' }"
          />
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-medium text-default">
              {{ $ts('module.system.sysLog.detail.responseBody') }}
            </h3>
            <div class="flex gap-1">
              <UButton size="xs" variant="ghost" color="neutral" :label="$ts(resultCompact ? 'common.format' : 'common.compact')" @click="resultCompact = !resultCompact" />
              <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-copy" :label="$ts('common.copy')" @click="copyPayload(data.requestResult, resultCompact)" />
            </div>
          </div>
          <UTextarea
            :model-value="formatPayload(data.requestResult, resultCompact)"
            readonly
            autoresize
            :rows="6"
            :maxrows="12"
            color="neutral"
            variant="subtle"
            class="w-full font-mono text-xs"
            :ui="{ base: 'max-h-56 overflow-auto leading-5' }"
          />
        </div>

        <UFormField :label="$ts('module.system.sysLog.detail.stackTrace')">
          <UTextarea
            :model-value="displayValue(data.trace)"
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

        <UFormField :label="$ts('module.system.sysLog.detail.userAgent')">
          <UTextarea
            :model-value="displayValue(data.userAgent)"
            readonly
            autoresize
            :rows="3"
            :maxrows="6"
            color="neutral"
            variant="subtle"
            class="w-full font-mono text-xs"
            :ui="{ base: 'max-h-32 overflow-auto leading-5' }"
          />
        </UFormField>
      </UCard>
    </template>

    <template #footer>
      <UButton color="neutral" variant="subtle" @click="visible = false">
        {{ $ts('common.close') }}
      </UButton>
    </template>
  </UModal>
</template>
