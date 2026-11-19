<script setup lang="ts">
import { type SysOauthAccountQueryDTO, SysOauthAccountQuerySchema } from '#admin/shared/system/oauthAccount'

const { $ts } = useI18n()
const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}
const emit = defineEmits<{
  search: [data: SysOauthAccountQueryDTO]
}>()

const schema = SysOauthAccountQuerySchema
const form = useTemplateRef('form')
const state = defineModel<SysOauthAccountQueryDTO>('model', { required: true })

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
    storage-key="sys-oauth-account-search-fab-pos"
    :before-submit="beforeSubmit"
    @search="submit"
    @reset="reset"
  >
    <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="px-2 pb-1">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-6 gap-y-6">
        <UFormField name="provider" :label="$ts('module.system.oauthAccount.provider')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.provider" :placeholder="$ts('module.system.oauthAccount.form.provider')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="providerLogin" :label="$ts('module.system.oauthAccount.providerLogin')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.providerLogin" :placeholder="$ts('module.system.oauthAccount.form.providerLogin')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="userId" :label="$ts('module.system.oauthAccount.userId')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.userId" :placeholder="$ts('module.system.oauthAccount.form.userId')" trailing="clear" class="w-full" />
        </UFormField>
      </div>
    </UForm>
  </FilterPanel>
</template>
