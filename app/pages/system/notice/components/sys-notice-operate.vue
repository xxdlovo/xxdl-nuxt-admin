<script setup lang="ts">
import {
  type SysNoticeAddDTO,
  SysNoticeAddSchema,
  type SysNoticeUpdateDTO,
  SysNoticeUpdateSchema,
  type SysNoticeDto
} from '#shared/system/notice'
import { parseDate, parseTime, type DateValue, type Time } from '@internationalized/date'
import type { FormSubmitEvent } from '@nuxt/ui'
import { businessDictCode } from '#shared/constants/business'
import { useToastSuccess } from '~/utils/toast'
import NoticeRichTextEditor from './NoticeRichTextEditor.vue'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const props = defineProps<{
  visible: boolean
  operateType: string
  data?: SysNoticeDto
  close?: () => void
  refresh?: () => void
}>()

const formItemUi = {
  root: 'flex flex-col gap-1 sm:flex-row sm:items-center',
  label: 'sm:w-20 sm:text-right sm:pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const state = ref<SysNoticeAddDTO | SysNoticeUpdateDTO>({
  id: '',
  title: '',
  summary: '',
  content: '',
  contentFormat: 'html',
  noticeType: 1,
  topFlag: 0,
  publishStatus: 1,
  publishTime: '',
  sortOrder: 0,
  remark: ''
})
const publishDateValue = shallowRef<DateValue | undefined>(undefined)
const publishTimeValue = shallowRef<Time | undefined>(undefined)

const { validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysNoticeAddSchema : SysNoticeUpdateSchema
})

const noticeTypeItems = useDictOptions(businessDictCode.noticeType)
const publishStatusItems = useDictOptions(businessDictCode.noticePublishStatus)
const topFlagItems = useDictOptions(businessDictCode.noYes)
const contentFormatItems = computed(() => [
  { label: 'HTML', value: 'html' },
  { label: 'Markdown', value: 'md' }
])

const noticeTypeValue = computed({
  get: () => String(state.value.noticeType ?? 1),
  set: val => state.value.noticeType = Number(val)
})
const publishStatusValue = computed({
  get: () => String(state.value.publishStatus ?? 1),
  set: val => state.value.publishStatus = Number(val)
})
const topFlagValue = computed({
  get: () => String(state.value.topFlag ?? 0),
  set: val => state.value.topFlag = Number(val)
})
const contentFormatValue = computed({
  get: () => state.value.contentFormat ?? 'html',
  set: val => state.value.contentFormat = val as 'html' | 'md'
})
const summaryValue = computed({
  get: () => state.value.summary ?? '',
  set: val => state.value.summary = val || ''
})
const contentValue = computed({
  get: () => state.value.content ?? '',
  set: val => state.value.content = val || ''
})
const remarkValue = computed({
  get: () => state.value.remark ?? '',
  set: val => state.value.remark = val || ''
})

const resetState = () => {
  Object.assign(state.value, {
    id: '',
    title: '',
    summary: '',
    content: '',
    contentFormat: 'html',
    noticeType: 1,
    topFlag: 0,
    publishStatus: 1,
    publishTime: '',
    sortOrder: 0,
    remark: ''
  })
  publishDateValue.value = undefined
  publishTimeValue.value = undefined
}

const syncPublishTime = () => {
  if (!publishDateValue.value) {
    state.value.publishTime = ''
    return
  }

  const date = publishDateValue.value.toString()
  const time = publishTimeValue.value?.toString().slice(0, 8) || '00:00:00'
  state.value.publishTime = `${date} ${time}`
}

const setPublishPickerValue = (value?: string | null) => {
  if (!value) {
    publishDateValue.value = undefined
    publishTimeValue.value = undefined
    return
  }

  const [datePart, timePart = '00:00:00'] = value.replace('T', ' ').split(' ')
  if (!datePart) {
    publishDateValue.value = undefined
    publishTimeValue.value = undefined
    return
  }

  try {
    publishDateValue.value = parseDate(datePart)
    publishTimeValue.value = parseTime(timePart.slice(0, 8))
  } catch {
    publishDateValue.value = undefined
    publishTimeValue.value = undefined
  }
}

watch([publishDateValue, publishTimeValue], syncPublishTime)

const initFormData = () => {
  resetState()
  if (props.operateType === 'edit' && props.data) {
    Object.assign(state.value, {
      id: props.data.id,
      title: props.data.title || '',
      summary: props.data.summary || '',
      content: props.data.content || '',
      contentFormat: props.data.contentFormat || 'html',
      noticeType: props.data.noticeType ?? 1,
      topFlag: props.data.topFlag ?? 0,
      publishStatus: props.data.publishStatus ?? 1,
      publishTime: props.data.publishTime || '',
      sortOrder: props.data.sortOrder ?? 0,
      remark: props.data.remark || ''
    })
    setPublishPickerValue(props.data.publishTime)
  }
}

watch(visible, (newVal) => {
  if (newVal) {
    initFormData()
  }
})

const closeDrawer = () => {
  props.close?.()
}

const handleSubmit = async (_event: FormSubmitEvent<SysNoticeAddDTO>) => {
  if (props.operateType === 'add') {
    await handleSave()
  } else if (props.operateType === 'edit') {
    await handleEdit()
  }
  closeDrawer()
  props.refresh?.()
}

const handleEdit = async () => {
  await $trpc.sysNotice.update.mutate(state.value as SysNoticeUpdateDTO)
  useToastSuccess($ts('common.modifySuccess'))
}

const handleSave = async () => {
  await $trpc.sysNotice.create.mutate(state.value)
  useToastSuccess($ts('common.addSuccess'))
}

const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.system.notice.addNotice'),
    edit: $ts('module.system.notice.editNotice')
  }
  return titles[props.operateType]
})
</script>

<template>
  <UModal v-model:open="visible" :title="title" :dismissible="false" :ui="{
    content: 'w-[calc(100vw-2rem)] max-w-[920px] overflow-hidden',
    body: 'p-4 sm:p-6 overflow-hidden',
    footer: 'justify-end gap-2 border-t border-default p-4 sm:px-6'
  }">
    <template #body>
      <UForm id="sys-notice-form" ref="form" :validate="validate" :state="state" class="max-h-[min(72vh,680px)] overflow-y-auto p-1" @submit="handleSubmit">
        <div class="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-2">
          <UFormField name="title" required :label="$ts('module.system.notice.noticeTitle')" orientation="horizontal" :ui="formItemUi" class="md:col-span-2">
            <UBaseInput v-model="state.title" :placeholder="$ts('module.system.notice.form.noticeTitle')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="noticeType" :label="$ts('module.system.notice.noticeType')" orientation="horizontal" :ui="formItemUi">
            <URadioGroup v-model="noticeTypeValue" orientation="horizontal" :items="noticeTypeItems" />
          </UFormField>
          <UFormField name="publishStatus" :label="$ts('module.system.notice.status')" orientation="horizontal" :ui="formItemUi">
            <URadioGroup v-model="publishStatusValue" orientation="horizontal" :items="publishStatusItems" />
          </UFormField>
          <UFormField name="topFlag" :label="$ts('module.system.notice.topFlag')" orientation="horizontal" :ui="formItemUi">
            <URadioGroup v-model="topFlagValue" orientation="horizontal" :items="topFlagItems" />
          </UFormField>
          <UFormField name="sortOrder" :label="$ts('module.system.notice.sortOrder')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.sortOrder" type="number" placeholder="0" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="publishTime" :label="$ts('module.system.notice.publishTime')" orientation="horizontal" :ui="formItemUi">
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <UInputDate
                v-model="publishDateValue"
                class="w-full"
                @update:model-value="syncPublishTime"
              />
              <UInputTime
                v-model="publishTimeValue"
                class="w-full"
                @update:model-value="syncPublishTime"
              />
            </div>
          </UFormField>
          <UFormField name="contentFormat" :label="$ts('module.system.notice.contentFormat')" orientation="horizontal" :ui="formItemUi">
            <USelect v-model="contentFormatValue" :items="contentFormatItems" class="w-full" />
          </UFormField>
          <UFormField name="summary" :label="$ts('module.system.notice.summary')" orientation="horizontal" :ui="formItemUi" class="md:col-span-2">
            <UTextarea v-model="summaryValue" :placeholder="$ts('module.system.notice.form.summary')" :rows="2" class="w-full" />
          </UFormField>
          <UFormField name="content" :label="$ts('module.system.notice.content')" orientation="vertical" class="md:col-span-2">
            <NoticeRichTextEditor
              v-if="contentFormatValue === 'html'"
              v-model="contentValue"
              :placeholder="$ts('module.system.notice.form.content')"
            />
            <UTextarea
              v-else
              v-model="contentValue"
              :placeholder="$ts('module.system.notice.form.content')"
              :rows="10"
              class="w-full font-mono text-sm"
            />
          </UFormField>
          <UFormField name="remark" :label="$ts('module.system.notice.remark')" orientation="horizontal" :ui="formItemUi" class="md:col-span-2">
            <UTextarea v-model="remarkValue" :placeholder="$ts('module.system.notice.form.remark')" :rows="2" class="w-full" />
          </UFormField>
        </div>
      </UForm>
    </template>

    <template #footer>
      <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" @click="closeDrawer" />
      <UButton :label="$ts('common.confirm')" color="primary" type="submit" form="sys-notice-form" />
    </template>
  </UModal>
</template>
