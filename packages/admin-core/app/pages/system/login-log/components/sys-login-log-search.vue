<template>
  <FilterPanel
    storage-key="sys-login-log-search-fab-pos"
    :before-submit="beforeSubmit"
    @search="submit"
    @reset="reset"
  >
    <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="px-2 pb-1">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-6 gap-y-6">
        <UFormField name="username" :label="$ts('module.system.loginLog.username')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.username" :placeholder="$ts('module.system.loginLog.form.username')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="ip" :label="$ts('module.system.loginLog.ip')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.ip" :placeholder="$ts('module.system.loginLog.form.ip')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="status" :label="$ts('module.system.loginLog.loginStatus')" orientation="horizontal" class="w-full" :ui="formItemUi">
          <USelect v-model.nullable="state.status" :placeholder="$ts('module.system.loginLog.form.loginStatus')" class="w-full" :items="statusItems" clearable />
        </UFormField>
      </div>
    </UForm>
  </FilterPanel>
</template>

<script setup lang="ts">
const { $ts } = useI18n()
import { businessDictCode } from '#admin/shared/constants/business'
import { type SysLoginLogQueryDTO, SysLoginLogQuerySchema } from '#admin/shared/system/loginLog'

const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}
const emit = defineEmits<{
  search: [data: SysLoginLogQueryDTO]
}>()

const schema = SysLoginLogQuerySchema
const form = useTemplateRef('form')
const state = defineModel<SysLoginLogQueryDTO>('model', { required: true })
const statusItems = useDictNumberOptions(businessDictCode.jobLogStatus, [1, 2])

const submit = () => {
  emit('search', state.value)
}

const beforeSubmit = async () => Boolean(await form.value?.validate({}))

const reset = () => {
  form.value?.clear()
  state.value = {}
}
</script>
