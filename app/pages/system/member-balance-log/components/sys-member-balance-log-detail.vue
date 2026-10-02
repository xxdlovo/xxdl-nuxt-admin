<script setup lang="ts">
import type { SysMemberBalanceLogDto } from '#shared/system/memberBalanceLog'
import { memberAccountRecord, memberBizTypeRecord, memberDirectionRecord } from '#shared/constants/business'

const props = defineProps<{
  visible: boolean
  data?: SysMemberBalanceLogDto | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const { $ts } = useI18n()

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const displayValue = (value: unknown) => (value == null || value === '' ? '-' : String(value))

const translate = (record: Record<string, string>, value?: string | null) => {
  if (!value) return '-'
  const key = record[value]

  return key ? $ts(key) : value
}

const detailItems = computed(() => {
  const item = props.data

  return [
    { label: $ts('module.system.memberBalanceLog.userId'), value: item?.userId },
    { label: $ts('module.system.memberBalanceLog.account'), value: translate(memberAccountRecord, item?.account) },
    { label: $ts('module.system.memberBalanceLog.direction'), value: translate(memberDirectionRecord, item?.direction) },
    { label: $ts('module.system.memberBalanceLog.amount'), value: item?.amount },
    { label: $ts('module.system.memberBalanceLog.balanceBefore'), value: item?.balanceBefore },
    { label: $ts('module.system.memberBalanceLog.balanceAfter'), value: item?.balanceAfter },
    { label: $ts('module.system.memberBalanceLog.bizType'), value: translate(memberBizTypeRecord, item?.bizType) },
    { label: $ts('module.system.memberBalanceLog.bizNo'), value: item?.bizNo },
    { label: $ts('module.system.memberBalanceLog.dedupKey'), value: item?.dedupKey },
    { label: $ts('module.system.memberBalanceLog.operatorId'), value: item?.operatorId },
    { label: $ts('module.system.memberBalanceLog.reason'), value: item?.reason },
    { label: $ts('module.system.memberBalanceLog.remark'), value: item?.remark },
    { label: $ts('module.system.memberBalanceLog.createdAt'), value: item?.createdAt }
  ]
})
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="$ts('module.system.memberBalanceLog.detailTitle')"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[760px]', footer: 'justify-end' }"
  >
    <template #body>
      <div v-if="data" class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
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
    </template>

    <template #footer>
      <UButton color="neutral" variant="subtle" @click="visible = false">
        {{ $ts('common.close') }}
      </UButton>
    </template>
  </UModal>
</template>
