<script setup lang="ts">
import { type SysPayChannelQueryDTO, SysPayChannelQuerySchema } from '#shared/system/payChannel'
import { businessDictCode, payChannelCodeRecord, payChannelModeRecord } from '#shared/constants/business'

const { $ts } = useI18n()
const formItemUi = {
  root: 'flex items-center',
  label: 'w-24 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  search: [data: SysPayChannelQueryDTO]
}>()

// 搜索条件的 schema 必须指向本模块的 QuerySchema
const schema = SysPayChannelQuerySchema
const form = useTemplateRef('form')
const active = ref(undefined)
const state = defineModel<SysPayChannelQueryDTO>('model', { required: true })
const statusItems = useDictNumberOptions(businessDictCode.enableStatus)
const channelCodeItems = useTransformRecordToOption(payChannelCodeRecord)
const modeItems = useTransformRecordToOption(payChannelModeRecord)

const statusValue = computed<number | undefined>({
  get: () => state.value.status ?? undefined,
  set: value => state.value.status = value === undefined || String(value) === '' ? undefined : Number(value)
})

const items = computed(() => [
  {
    label: $ts('common.search'),
    icon: ''
  }
])

const submit = async () => {
  const isValid = await form.value?.validate({})
  if (isValid) {
    emit('search', state.value)
  }
}

const reset = () => {
  form.value?.clear()
  state.value = {}
}
</script>

<template>
  <UCard :ui="{ body: ' p-0 sm:p-0 pl-2  sm:pl-2' }" class="w-full cursor-pointer">
    <UAccordion v-model="active" :items="items">
      <template #leading="{ open }">
        <UIcon :name="open ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="cursor-pointer" />
      </template>
      <template #trailing>
        &nbsp;
      </template>
      <template #content>
        <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="p-2">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-6">
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
            <div class="lg:col-start-4 flex flex-col pr-8">
              <div class="gap-2 flex justify-end">
                <UButton icon="tabler:reload" @click="reset" variant="outline" color="neutral">{{ $ts('common.reset') }}
                </UButton>
                <UButton icon="tabler:search" @click="submit" variant="outline">{{ $ts('common.search') }}</UButton>
              </div>
              <div class="min-h-[20px]"></div>
            </div>
          </div>
        </UForm>
      </template>
    </UAccordion>
  </UCard>
</template>
