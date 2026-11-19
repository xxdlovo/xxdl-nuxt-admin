<script setup lang="ts">
import { type SysPayChannelQueryDTO, SysPayChannelQuerySchema } from '#trade/shared/system/payChannel'
import { businessDictCode, payChannelCodeRecord, payChannelModeRecord } from '#admin/shared/constants/business'

const { $ts } = useI18n()
const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  search: [data: SysPayChannelQueryDTO]
}>()

// 搜索条件的 schema 必须指向本模块的 QuerySchema
const schema = SysPayChannelQuerySchema
const form = useTemplateRef('form')
const state = defineModel<SysPayChannelQueryDTO>('model', { required: true })
const statusItems = useDictNumberOptions(businessDictCode.enableStatus)
const channelCodeItems = useTransformRecordToOption(payChannelCodeRecord)
const modeItems = useTransformRecordToOption(payChannelModeRecord)

const statusValue = computed<number | undefined>({
  get: () => state.value.status ?? undefined,
  set: value => state.value.status = value === undefined || String(value) === '' ? undefined : Number(value)
})

const submit = () => {
  emit('search', state.value)
}

const beforeSubmit = async () => Boolean(await form.value?.validate({}))

const reset = () => {
  form.value?.clear()
  state.value = {}
}
</script>

<template>
  <FilterPanel
    storage-key="sys-pay-channel-search-fab-pos"
    :before-submit="beforeSubmit"
    @search="submit"
    @reset="reset"
  >
    <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="px-2 pb-1">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-6 gap-y-6">
        <UFormField name="configName" :label="$ts('module.system.payChannel.configName')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.configName" :placeholder="$ts('module.system.payChannel.form.configName')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="configKey" :label="$ts('module.system.payChannel.configKey')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.configKey" :placeholder="$ts('module.system.payChannel.form.configKey')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="channelCode" :label="$ts('module.system.payChannel.channelCode')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="state.channelCode" :placeholder="$ts('module.system.payChannel.form.channelCode')" class="w-full" :items="channelCodeItems" clearable />
        </UFormField>
        <UFormField name="mode" :label="$ts('module.system.payChannel.modeLabel')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="state.mode" :placeholder="$ts('module.system.payChannel.form.mode')" class="w-full" :items="modeItems" clearable />
        </UFormField>
        <UFormField name="status" :label="$ts('module.system.payChannel.status')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="statusValue" :placeholder="$ts('module.system.payChannel.form.status')" class="w-full" :items="statusItems" clearable />
        </UFormField>
      </div>
    </UForm>
  </FilterPanel>
</template>
