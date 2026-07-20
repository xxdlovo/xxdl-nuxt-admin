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
        <UForm ref="form" :validateOn="['input']" :schema="schema" :state="state" class="p-2">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-6">
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
              <USelect v-model.nullable="state.status" :placeholder="$ts('module.system.oss.form.ossStatus')" class="w-full" :items="translateOptions(enableStatusOptions)" clearable />
            </UFormField>
            <div class="lg:col-start-4 flex flex-col pr-8">
              <div class="gap-2 flex justify-end">
                <UButton icon="tabler:reload" @click="reset" variant="outline" color="neutral">{{ $ts('common.reset') }}</UButton>
                <UButton icon="tabler:search" @click="submit" variant="outline">{{ $ts('common.search') }}</UButton>
              </div>
              <div class="min-h-[20px]" />
            </div>
          </div>
        </UForm>
      </template>
    </UAccordion>
  </UCard>
</template>

<script setup lang="ts">
import { type SysOssQueryDTO, SysOssQuerySchema } from '#shared/system/oss'
import { enableStatusOptions } from '#shared/constants/business'
import { translateOptions } from '~/utils/common'

const { $ts } = useI18n()
const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}
const emit = defineEmits<{
  search: [data: SysOssQueryDTO]
}>()

const schema = SysOssQuerySchema
const form = useTemplateRef('form')
const active = ref(undefined)
const state = defineModel<SysOssQueryDTO>('model', { required: true })
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
