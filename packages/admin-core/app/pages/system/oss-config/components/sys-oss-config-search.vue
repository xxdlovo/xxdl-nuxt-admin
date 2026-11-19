<template>
  <FilterPanel
    storage-key="sys-oss-config-search-fab-pos"
    :before-submit="beforeSubmit"
    @search="submit"
    @reset="reset"
  >
    <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="px-2 pb-1">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-6 gap-y-6">
        <UFormField name="configKey" :label="$ts('module.system.ossConfig.configKey')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.configKey" :placeholder="$ts('module.system.ossConfig.form.configKey')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="configName" :label="$ts('module.system.ossConfig.configName')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.configName" :placeholder="$ts('module.system.ossConfig.form.configName')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="service" :label="$ts('module.system.ossConfig.service')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model="serviceValue" :placeholder="$ts('module.system.ossConfig.form.service')" class="w-full" :items="serviceItems" clearable />
        </UFormField>
        <UFormField name="status" :label="$ts('module.system.ossConfig.configStatus')" orientation="horizontal" class="w-full" :ui="formItemUi">
          <USelect v-model.nullable="state.status" :placeholder="$ts('module.system.ossConfig.form.configStatus')" class="w-full" :items="statusItems" clearable />
        </UFormField>
      </div>
    </UForm>
  </FilterPanel>
</template>

<script setup lang="ts">
import { type SysOssConfigQueryDTO, SysOssConfigQuerySchema } from '#admin/shared/system/ossConfig'
import { businessDictCode } from '#admin/shared/constants/business'

const { $ts } = useI18n()
const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}
const emit = defineEmits<{
  search: [data: SysOssConfigQueryDTO]
}>()

const schema = SysOssConfigQuerySchema
const form = useTemplateRef('form')
const state = defineModel<SysOssConfigQueryDTO>('model', { required: true })
const serviceValue = computed({
  get: () => state.value.service ?? undefined,
  set: value => state.value.service = value || undefined
})
const serviceItems = useDictOptions(businessDictCode.ossService)
const statusItems = useDictNumberOptions(businessDictCode.enableStatus)

const submit = () => {
  emit('search', state.value)
}

const beforeSubmit = async () => Boolean(await form.value?.validate({}))

const reset = () => {
  form.value?.clear()
  state.value = {}
}
</script>
