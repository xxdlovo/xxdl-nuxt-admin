<script setup lang="ts">
import { type SysOauthConfigQueryDTO, SysOauthConfigQuerySchema } from '#admin/shared/system/oauthConfig'
import { businessDictCode } from '#admin/shared/constants/business'

const { $ts } = useI18n()
const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}
const emit = defineEmits<{
  search: [data: SysOauthConfigQueryDTO]
}>()

const schema = SysOauthConfigQuerySchema
const form = useTemplateRef('form')
const state = defineModel<SysOauthConfigQueryDTO>('model', { required: true })
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

<template>
  <FilterPanel
    storage-key="sys-oauth-config-search-fab-pos"
    :before-submit="beforeSubmit"
    @search="submit"
    @reset="reset"
  >
    <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="px-2 pb-1">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-6 gap-y-6">
        <UFormField name="platform" :label="$ts('module.system.oauthConfig.platform')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.platform" :placeholder="$ts('module.system.oauthConfig.form.platform')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="platformName" :label="$ts('module.system.oauthConfig.platformName')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.platformName" :placeholder="$ts('module.system.oauthConfig.form.platformName')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="status" :label="$ts('module.system.oauthConfig.status')" orientation="horizontal" class="w-full" :ui="formItemUi">
          <USelect v-model.nullable="state.status" :placeholder="$ts('module.system.oauthConfig.form.status')" class="w-full" :items="statusItems" clearable />
        </UFormField>
      </div>
    </UForm>
  </FilterPanel>
</template>
