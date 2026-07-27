<script setup lang="ts">
import type { SysJobLogDto } from '#shared/system/jobLog'
import { useToastSuccess } from '~/utils/toast'

const props = defineProps<{
  visible: boolean
  data?: SysJobLogDto | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const { $ts } = useI18n()
const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})
const resultCompact = ref(false)

function parseValue(value: unknown) {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function formatPayload(value: unknown, compact = false) {
  if (value == null || value === '') return '-'
  const parsed = parseValue(value)
  if (typeof parsed === 'string') return parsed
  return JSON.stringify(parsed, null, compact ? 0 : 2)
}

async function copyPayload(value: unknown, compact = false) {
  const text = formatPayload(value, compact)
  if (text === '-') return
  try {
    await navigator.clipboard?.writeText(text)
    useToastSuccess($ts('common.copySuccess'))
  } catch {
    // Clipboard access can be unavailable in insecure browser contexts.
  }
}

function displayValue(value: unknown) {
  return value == null || value === '' ? '-' : String(value)
}

const detailItems = computed(() => {
  const item = props.data
  return [
    { label: $ts('module.system.jobLog.jobName'), value: item?.jobName },
    { label: $ts('module.system.jobLog.jobCode'), value: item?.jobCode },
    { label: $ts('module.system.jobLog.handlerCode'), value: item?.handlerCode },
    { label: $ts('module.system.jobLog.cronExpression'), value: item?.cronExpression },
    { label: $ts('module.system.jobLog.triggerType.title'), value: item?.triggerType },
    { label: $ts('module.system.jobLog.startedAt'), value: item?.startedAt },
    { label: $ts('module.system.jobLog.finishedAt'), value: item?.finishedAt },
    { label: $ts('module.system.jobLog.durationMs'), value: item?.durationMs == null ? '-' : `${item.durationMs}ms` }
  ]
})
</script>

<template>
  <UModal v-model:open="visible" :title="$ts('module.system.jobLog.detailTitle')" :ui="{ content: 'max-w-[860px]', footer: 'justify-end' }">
    <template #body>
      <UCard v-if="data" variant="subtle" :ui="{ body: 'space-y-4' }">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          <UFormField
            v-for="item in detailItems"
            :key="item.label"
            :label="item.label"
            orientation="horizontal"
            :ui="{ root: 'items-start', labelWrapper: 'w-28 shrink-0 pt-1', container: 'min-w-0 flex-1' }"
          >
            <UInput :model-value="displayValue(item.value)" readonly color="neutral" variant="subtle" class="w-full" :ui="{ base: 'break-all' }" />
          </UFormField>
        </div>

        <USeparator />

        <div class="space-y-3">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-medium text-default">
              {{ $ts('module.system.jobLog.result') }}
            </h3>
            <div class="flex gap-1">
              <UButton size="xs" variant="ghost" color="neutral" :label="$ts(resultCompact ? 'common.format' : 'common.compact')" @click="resultCompact = !resultCompact" />
              <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-copy" :label="$ts('common.copy')" @click="copyPayload(data.result, resultCompact)" />
            </div>
          </div>
          <UTextarea
            :model-value="formatPayload(data.result, resultCompact)"
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

        <UFormField :label="$ts('module.system.jobLog.errorMessage')">
          <UTextarea :model-value="displayValue(data.errorMessage)" readonly autoresize :rows="3" :maxrows="8" color="neutral" variant="subtle" class="w-full font-mono text-xs" />
        </UFormField>

        <UFormField :label="$ts('module.system.jobLog.errorStack')">
          <UTextarea :model-value="displayValue(data.errorStack)" readonly autoresize :rows="4" :maxrows="10" color="neutral" variant="subtle" class="w-full font-mono text-xs" />
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
