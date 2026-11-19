<template>
  <FilterPanel
    storage-key="sys-log-search-fab-pos"
    :before-submit="beforeSubmit"
    @search="submit"
    @reset="reset"
  >
    <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="px-2 pb-1">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-6 gap-y-6">
        <UFormField name="module" :label="$ts('module.system.sysLog.logModule')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.module" :placeholder="$ts('module.system.sysLog.form.logModule')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="message" :label="$ts('module.system.sysLog.logMessage')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.message" :placeholder="$ts('module.system.sysLog.form.logMessage')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="level" :label="$ts('module.system.sysLog.logLevel')" orientation="horizontal" class="w-full" :ui="formItemUi">
          <USelect v-model.nullable="state.level" :placeholder="$ts('module.system.sysLog.form.logLevel')" class="w-full" :items="levelItems" clearable />
        </UFormField>
      </div>
    </UForm>
  </FilterPanel>
</template>

<script setup lang="ts">
const { $ts } = useI18n()
import { businessDictCode } from '#admin/shared/constants/business'
import { type SysLogQueryDTO, SysLogQuerySchema } from '#admin/shared/system/SysLog'

const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}
const emit = defineEmits<{
  search: [data: SysLogQueryDTO]
}>()

const schema = SysLogQuerySchema
const form = useTemplateRef('form')
const state = defineModel<SysLogQueryDTO>('model', { required: true })
const levelItems = useDictNumberOptions(businessDictCode.sysLogLevel)

const submit = () => {
  emit('search', state.value)
}

const beforeSubmit = async () => Boolean(await form.value?.validate({}))

const reset = () => {
  form.value?.clear()
  state.value = {}
}
</script>
