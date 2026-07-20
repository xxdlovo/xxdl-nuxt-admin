<script setup lang="ts">
import type { SysLoginLogDto } from '#shared/system/loginLog'

const props = defineProps<{
  visible: boolean
  data?: SysLoginLogDto | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const { $ts } = useI18n()
const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const detailItems = computed(() => {
  const item = props.data

  return [
    { label: $ts('module.system.loginLog.detail.user'), value: item?.username || item?.userId || '-' },
    { label: $ts('module.system.loginLog.detail.loginTime'), value: item?.loginTime || '-' },
    { label: $ts('module.system.loginLog.detail.operationTime'), value: item?.createdAt || '-' },
    { label: $ts('module.system.loginLog.detail.loginType'), value: item?.loginType || '-' },
    { label: $ts('module.system.loginLog.detail.ip'), value: item?.ip || '-' },
    { label: $ts('module.system.loginLog.detail.location'), value: item?.location || '-' },
    { label: $ts('module.system.loginLog.detail.browser'), value: item?.browser || '-' },
    { label: $ts('module.system.loginLog.detail.os'), value: item?.os || '-' },
    { label: $ts('module.system.loginLog.detail.errorCode'), value: item?.errorCode || '-' },
    { label: $ts('module.system.loginLog.detail.traceId'), value: item?.traceId || '-' },
    { label: $ts('module.system.loginLog.detail.createdBy'), value: item?.createdBy || '-' },
    { label: $ts('module.system.loginLog.detail.updatedAt'), value: item?.updatedAt || '-' },
    { label: $ts('module.system.loginLog.detail.remark'), value: item?.remark || '-' }
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
  <UModal v-model:open="visible" :title="$ts('module.system.loginLog.detail.title')" :ui="{ content: 'max-w-[760px]', footer: 'justify-end' }">
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

        <UFormField :label="$ts('module.system.loginLog.detail.userAgent')">
          <UTextarea
            :model-value="displayValue(data.userAgent)"
            readonly
            autoresize
            :rows="4"
            :maxrows="8"
            color="neutral"
            variant="subtle"
            class="w-full font-mono text-xs"
            :ui="{ base: 'max-h-40 overflow-auto leading-5' }"
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
