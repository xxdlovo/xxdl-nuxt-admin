<template>
  <FilterPanel
    storage-key="sys-post-search-fab-pos"
    :before-submit="beforeSubmit"
    @search="submit"
    @reset="reset"
  >
    <UForm ref="form" :schema="schema" :state="state" :validate-on="['input']" class="px-2 pb-1">
      <div class="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        <UFormField name="name" :label="$ts('module.system.post.name')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.name" :placeholder="$ts('module.system.post.form.name')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="code" :label="$ts('module.system.post.code')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.code" :placeholder="$ts('module.system.post.form.code')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="status" :label="$ts('module.system.post.status')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="state.status" :items="statusItems" :placeholder="$ts('module.system.post.form.status')" clearable class="w-full" />
        </UFormField>
      </div>
    </UForm>
  </FilterPanel>
</template>

<script setup lang="ts">
import { SysPostQuerySchema, type SysPostQueryDTO } from '#admin/shared/system/post'
import { businessDictCode } from '#admin/shared/constants/business'

const { $ts } = useI18n()
const emit = defineEmits<{ search: [data: SysPostQueryDTO] }>()
const form = useTemplateRef('form')
const state = defineModel<SysPostQueryDTO>('model', { required: true })
const schema = SysPostQuerySchema
const statusItems = useDictNumberOptions(businessDictCode.enableStatus)
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
