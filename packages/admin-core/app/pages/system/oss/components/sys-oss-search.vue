<template>
  <FilterPanel
    storage-key="sys-oss-search-fab-pos"
    :before-submit="beforeSubmit"
    @search="submit"
    @reset="reset"
  >
    <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="px-2 pb-1">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-6 gap-y-6">
        <UFormField name="originalName" :label="$ts('module.system.oss.originalName')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.originalName" :placeholder="$ts('module.system.oss.form.originalName')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="fileName" :label="$ts('module.system.oss.fileName')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.fileName" :placeholder="$ts('module.system.oss.form.fileName')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="service" :label="$ts('module.system.oss.service')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model="serviceValue" :placeholder="$ts('module.system.oss.form.service')" class="w-full" :items="serviceItems" clearable />
        </UFormField>
        <UFormField name="status" :label="$ts('module.system.oss.ossStatus')" orientation="horizontal" class="w-full" :ui="formItemUi">
          <USelect v-model.nullable="state.status" :placeholder="$ts('module.system.oss.form.ossStatus')" class="w-full" :items="statusItems" clearable />
        </UFormField>
      </div>
    </UForm>
  </FilterPanel>
</template>

<script setup lang="ts">
import { type SysOssQueryDTO, SysOssQuerySchema } from '#admin/shared/system/oss'
import { businessDictCode } from '#admin/shared/constants/business'

const { $ts } = useI18n()
const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}
const emit = defineEmits<{
  search: [data: SysOssQueryDTO]
}>()

const schema = SysOssQuerySchema
const form = useTemplateRef('form')
const state = defineModel<SysOssQueryDTO>('model', { required: true })
const statusItems = useDictNumberOptions(businessDictCode.enableStatus)
const serviceValue = computed({
  get: () => state.value.service ?? undefined,
  set: value => state.value.service = value || undefined
})
const serviceItems = computed(() => [
  { label: 'Local', value: 'local' },
  { label: 'MinIO', value: 'minio' },
  { label: 'Aliyun OSS', value: 'aliyun' },
  { label: 'Tencent COS', value: 'tencent' },
  { label: 'Qiniu', value: 'qiniu' }
])

const submit = () => {
  emit('search', state.value)
}

const beforeSubmit = async () => Boolean(await form.value?.validate({}))

const reset = () => {
  form.value?.clear()
  state.value = {}
}
</script>
