<template>
  <FilterPanel
    storage-key="sys-notice-search-fab-pos"
    :before-submit="beforeSubmit"
    @search="submit"
    @reset="reset"
  >
    <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="px-2 pb-1">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-6 gap-y-6">
        <UFormField name="title" :label="$ts('module.system.notice.noticeTitle')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.title" :placeholder="$ts('module.system.notice.form.noticeTitle')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="noticeType" :label="$ts('module.system.notice.noticeType')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="state.noticeType" :placeholder="$ts('module.system.notice.form.noticeType')" class="w-full" :items="noticeTypeItems" clearable />
        </UFormField>
        <UFormField name="publishStatus" :label="$ts('module.system.notice.status')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="state.publishStatus" :placeholder="$ts('module.system.notice.form.status')" class="w-full" :items="publishStatusItems" clearable />
        </UFormField>
      </div>
    </UForm>
  </FilterPanel>
</template>

<script setup lang="ts">
import { businessDictCode } from '#admin/shared/constants/business'
import { type SysNoticeQueryDTO, SysNoticeQuerySchema } from '#admin/shared/system/notice'

const { $ts } = useI18n()
const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  search: [data: SysNoticeQueryDTO]
}>()

const schema = SysNoticeQuerySchema
const form = useTemplateRef('form')
const state = defineModel<SysNoticeQueryDTO>('model', { required: true })
const noticeTypeItems = useDictNumberOptions(businessDictCode.noticeType)
const publishStatusItems = useDictNumberOptions(businessDictCode.noticePublishStatus)

const submit = () => {
  emit('search', state.value)
}

const beforeSubmit = async () => Boolean(await form.value?.validate({}))

const reset = () => {
  form.value?.clear()
  state.value = {}
}
</script>
