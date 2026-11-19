<template>
  <FilterPanel
    storage-key="sys-job-search-fab-pos"
    :before-submit="beforeSubmit"
    @search="submit"
    @reset="reset"
  >
    <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="px-2 pb-1">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-6 gap-y-6">
        <UFormField name="jobName" :label="$ts('module.system.job.jobName')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.jobName" :placeholder="$ts('module.system.job.form.jobName')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="jobCode" :label="$ts('module.system.job.jobCode')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.jobCode" :placeholder="$ts('module.system.job.form.jobCode')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="status" :label="$ts('module.system.job.status')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="state.status" :placeholder="$ts('module.system.job.form.status')" class="w-full" :items="statusItems" clearable />
        </UFormField>
      </div>
    </UForm>
  </FilterPanel>
</template>

<script setup lang="ts">
import { businessDictCode } from '#admin/shared/constants/business'
import { type SysJobQueryDTO, SysJobQuerySchema } from '#admin/shared/system/job'

const { $ts } = useI18n()
const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  search: [data: SysJobQueryDTO]
}>()

const schema = SysJobQuerySchema
const form = useTemplateRef('form')
const state = defineModel<SysJobQueryDTO>('model', { required: true })
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
