<template>
  <UCard :ui="{ body: 'p-0 sm:p-0 pl-2 sm:pl-2' }" class="w-full cursor-pointer">
    <UAccordion v-model="active" :items="items">
      <template #leading="{ open }">
        <UIcon :name="open ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="cursor-pointer" />
      </template>
      <template #trailing>
        &nbsp;
      </template>
      <template #content>
        <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="p-2">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-6">
            <UFormField name="title" :label="$ts('module.system.notice.noticeTitle')" orientation="horizontal" :ui="formItemUi">
              <UBaseInput v-model="state.title" :placeholder="$ts('module.system.notice.form.noticeTitle')" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="noticeType" :label="$ts('module.system.notice.noticeType')" orientation="horizontal" :ui="formItemUi">
              <USelect v-model.nullable="state.noticeType" :placeholder="$ts('module.system.notice.form.noticeType')" class="w-full" :items="translateOptions(noticeTypeOptions)" clearable />
            </UFormField>
            <UFormField name="publishStatus" :label="$ts('module.system.notice.status')" orientation="horizontal" :ui="formItemUi">
              <USelect v-model.nullable="state.publishStatus" :placeholder="$ts('module.system.notice.form.status')" class="w-full" :items="translateOptions(noticePublishStatusOptions)" clearable />
            </UFormField>
            <div class="lg:col-start-4 flex flex-col pr-8">
              <div class="gap-2 flex justify-end">
                <UButton icon="tabler:reload" variant="outline" color="neutral" @click="reset">{{ $ts('common.reset') }}</UButton>
                <UButton icon="tabler:search" variant="outline" @click="submit">{{ $ts('common.search') }}</UButton>
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
import { noticePublishStatusOptions, noticeTypeOptions } from '#shared/constants/business'
import { type SysNoticeQueryDTO, SysNoticeQuerySchema } from '#shared/system/notice'
import { translateOptions } from '~/utils/common'

const { $ts } = useI18n()
const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  search: [data: SysNoticeQueryDTO]
}>()

const schema = SysNoticeQuerySchema
const form = useTemplateRef('form')
const active = ref(undefined)
const state = defineModel<SysNoticeQueryDTO>('model', { required: true })
const items = computed(() => [{ label: $ts('common.search'), icon: '' }])

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
