<template>
  <FilterPanel
    storage-key="sys-config-search-fab-pos"
    :before-submit="beforeSubmit"
    @search="submit"
    @reset="reset"
  >
    <UForm ref="form" :schema="schema" :state="state" :validate-on="['input']" class="px-2 pb-1">
      <div class="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        <UFormField name="configName" :label="$ts('module.system.config.configName')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.configName" :placeholder="$ts('module.system.config.form.configName')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="configKey" :label="$ts('module.system.config.configKey')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.configKey" :placeholder="$ts('module.system.config.form.configKey')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="configType" :label="$ts('module.system.config.configType')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="state.configType" :items="configTypeItems" :placeholder="$ts('module.system.config.form.configType')" clearable class="w-full" />
        </UFormField>
        <UFormField name="status" :label="$ts('module.system.config.status')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="state.status" :items="statusItems" :placeholder="$ts('module.system.config.form.status')" clearable class="w-full" />
        </UFormField>
      </div>
    </UForm>
  </FilterPanel>
</template>

<script setup lang="ts">
import { SysConfigQuerySchema, type SysConfigQueryDTO } from '#admin/shared/system/config'
import { businessDictCode } from '#admin/shared/constants/business'

const { $ts } = useI18n()
const emit = defineEmits<{ search: [data: SysConfigQueryDTO] }>()
const form = useTemplateRef('form')
const state = defineModel<SysConfigQueryDTO>('model', { required: true })
const schema = SysConfigQuerySchema
const statusItems = useDictNumberOptions(businessDictCode.enableStatus)
const configTypeItems = computed(() => [
  { label: $ts('module.system.config.type.system'), value: 1 },
  { label: $ts('module.system.config.type.custom'), value: 2 }
])
const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap shrink-0 pr-2 text-right',
  container: 'flex-1'
}

const submit = () => {
  emit('search', state.value)
}

const beforeSubmit = async () => Boolean(await form.value?.validate({}))

const reset = () => {
  form.value?.clear()
  state.value = {}
}
</script>
