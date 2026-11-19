<script setup lang="ts">
import { type SysPayNotifyLogQueryDTO, SysPayNotifyLogQuerySchema } from '#trade/shared/system/payNotifyLog'
import { payChannelCodeRecord, payNotifyResultConfig, payNotifySourceRecord } from '#admin/shared/constants/business'

const { $ts } = useI18n()
const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  search: [data: SysPayNotifyLogQueryDTO]
}>()

// 搜索条件的 schema 必须指向本模块的 QuerySchema
const schema = SysPayNotifyLogQuerySchema
const form = useTemplateRef('form')
const state = defineModel<SysPayNotifyLogQueryDTO>('model', { required: true })

const channelCodeItems = useTransformRecordToOption(payChannelCodeRecord)
const sourceItems = useTransformRecordToOption(payNotifySourceRecord)
const resultItems = useTransformRecordToOption(
  Object.fromEntries(Object.entries(payNotifyResultConfig).map(([value, config]) => [value, config.i18nKey]))
)

const createdFrom = ref<string>('')
const createdTo = ref<string>('')

const submit = async () => {
  state.value.createdFrom = createdFrom.value ? `${createdFrom.value} 00:00:00` : undefined
  state.value.createdTo = createdTo.value ? `${createdTo.value} 23:59:59` : undefined
  emit('search', state.value)
}

const beforeSubmit = async () => Boolean(await form.value?.validate({}))

const reset = () => {
  form.value?.clear()
  createdFrom.value = ''
  createdTo.value = ''
  state.value = {}
}
</script>

<template>
  <FilterPanel
    storage-key="sys-pay-notify-log-search-fab-pos"
    :before-submit="beforeSubmit"
    @search="submit"
    @reset="reset"
  >
    <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="px-2 pb-1">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-6 gap-y-6">
        <UFormField name="outTradeNo" :label="$ts('module.system.payNotifyLog.outTradeNo')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.outTradeNo" :placeholder="$ts('module.system.payNotifyLog.form.outTradeNo')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="channelCode" :label="$ts('module.system.payNotifyLog.channelCode')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="state.channelCode" :placeholder="$ts('module.system.payNotifyLog.form.channelCode')" class="w-full" :items="channelCodeItems" clearable />
        </UFormField>
        <UFormField name="source" :label="$ts('module.system.payNotifyLog.sourceLabel')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="state.source" :placeholder="$ts('module.system.payNotifyLog.form.source')" class="w-full" :items="sourceItems" clearable />
        </UFormField>
        <UFormField name="processResult" :label="$ts('module.system.payNotifyLog.processResult')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="state.processResult" :placeholder="$ts('module.system.payNotifyLog.form.processResult')" class="w-full" :items="resultItems" clearable />
        </UFormField>
        <UFormField name="orderId" :label="$ts('module.system.payNotifyLog.orderId')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.orderId" :placeholder="$ts('module.system.payNotifyLog.form.orderId')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="createdFrom" :label="$ts('module.system.payNotifyLog.createdFrom')" orientation="horizontal" :ui="formItemUi">
          <UInput v-model="createdFrom" type="date" class="w-full" />
        </UFormField>
        <UFormField name="createdTo" :label="$ts('module.system.payNotifyLog.createdTo')" orientation="horizontal" :ui="formItemUi">
          <UInput v-model="createdTo" type="date" class="w-full" />
        </UFormField>
      </div>
    </UForm>
  </FilterPanel>
</template>
