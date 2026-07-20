<script setup lang="ts">
import {
  type SysOssAddDTO,
  SysOssAddSchema,
  type SysOssUpdateDTO,
  SysOssUpdateSchema,
  type SysOssDto
} from '#shared/system/oss'
import type { FormSubmitEvent } from '@nuxt/ui'
import { useTransformRecordToOption } from '~/composables/useTransformRecordToOption'
import { enableStatusRecord } from '#shared/constants/business'
import { useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const props = defineProps<{
  visible: boolean
  operateType: string
  data?: SysOssDto
  close?: () => void
  refresh?: () => void
}>()

const formItemUi = {
  root: 'flex items-center',
  label: 'w-24 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const state = ref<SysOssAddDTO | SysOssUpdateDTO>({
  id: '',
  configId: '',
  fileName: '',
  originalName: '',
  fileSuffix: '',
  fileSize: 0,
  contentType: '',
  bucketName: '',
  objectName: '',
  url: '',
  md5: '',
  etag: '',
  service: 'local',
  uploadUserId: '',
  status: 1,
  remark: ''
})

const statusValue = computed({
  get: () => String(state.value.status || 0),
  set: val => state.value.status = Number(val)
})

const { validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysOssAddSchema : SysOssUpdateSchema
})
const statusItems = useTransformRecordToOption(enableStatusRecord)
const serviceItems = computed(() => [
  { label: 'Local', value: 'local' },
  { label: 'MinIO', value: 'minio' },
  { label: 'Aliyun OSS', value: 'aliyun' },
  { label: 'Tencent COS', value: 'tencent' },
  { label: 'Qiniu', value: 'qiniu' }
])

const closeDrawer = () => {
  props.close?.()
}

const initFormData = () => {
  if (props.operateType === 'edit' && props.data) {
    Object.assign(state.value, {
      id: props.data.id,
      configId: props.data.configId || '',
      fileName: props.data.fileName || '',
      originalName: props.data.originalName || '',
      fileSuffix: props.data.fileSuffix || '',
      fileSize: props.data.fileSize || 0,
      contentType: props.data.contentType || '',
      bucketName: props.data.bucketName || '',
      objectName: props.data.objectName || '',
      url: props.data.url || '',
      md5: props.data.md5 || '',
      etag: props.data.etag || '',
      service: props.data.service || 'local',
      uploadUserId: props.data.uploadUserId || '',
      status: props.data.status ?? 1,
      remark: props.data.remark || ''
    })
  } else if (props.operateType === 'add') {
    Object.assign(state.value, {
      id: '',
      configId: '',
      fileName: '',
      originalName: '',
      fileSuffix: '',
      fileSize: 0,
      contentType: '',
      bucketName: '',
      objectName: '',
      url: '',
      md5: '',
      etag: '',
      service: 'local',
      uploadUserId: '',
      status: 1,
      remark: ''
    })
  }
}

watch(visible, (newVal) => {
  if (newVal) {
    initFormData()
  }
})

const handleSubmit = async (event: FormSubmitEvent<SysOssAddDTO>) => {
  if (props.operateType === 'add') {
    await handleSave()
  } else if (props.operateType === 'edit') {
    await handleEdit()
  }
  closeDrawer()
  props.refresh?.()
}

const handleEdit = async () => {
  await $trpc.sysOss.update.mutate(state.value as SysOssUpdateDTO)
  useToastSuccess($ts('common.modifySuccess'))
}

const handleSave = async () => {
  await $trpc.sysOss.create.mutate(state.value)
  useToastSuccess($ts('common.addSuccess'))
}

const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.system.oss.addSysOss'),
    edit: $ts('module.system.oss.editSysOss')
  }
  return titles[props.operateType]
})
</script>

<template>
  <UModal v-model:open="visible" :title="title" :dismissible="false" :ui="{
    content: 'max-w-[720px]',
    footer: 'justify-end'
  }">
    <template #body>
      <UForm ref="form" :validate="validate" :state="state" class="p-2" @submit="handleSubmit">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
          <UFormField name="originalName" required :label="$ts('module.system.oss.originalName')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.originalName" :placeholder="$ts('module.system.oss.form.originalName')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="fileName" required :label="$ts('module.system.oss.fileName')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.fileName" :placeholder="$ts('module.system.oss.form.fileName')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="objectName" required :label="$ts('module.system.oss.objectName')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.objectName" :placeholder="$ts('module.system.oss.form.objectName')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="url" required :label="$ts('module.system.oss.url')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.url" :placeholder="$ts('module.system.oss.form.url')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="service" required :label="$ts('module.system.oss.service')" orientation="horizontal" :ui="formItemUi">
            <USelect v-model="state.service" :placeholder="$ts('module.system.oss.form.service')" :items="serviceItems" class="w-full" />
          </UFormField>
          <UFormField name="bucketName" :label="$ts('module.system.oss.bucketName')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.bucketName" :placeholder="$ts('module.system.oss.form.bucketName')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="fileSuffix" :label="$ts('module.system.oss.fileSuffix')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.fileSuffix" :placeholder="$ts('module.system.oss.form.fileSuffix')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="fileSize" :label="$ts('module.system.oss.fileSize')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model.number="state.fileSize" type="number" :placeholder="$ts('module.system.oss.form.fileSize')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="contentType" :label="$ts('module.system.oss.contentType')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.contentType" :placeholder="$ts('module.system.oss.form.contentType')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="md5" :label="$ts('module.system.oss.md5')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.md5" :placeholder="$ts('module.system.oss.form.md5')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="remark" :label="$ts('module.system.oss.remark')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.remark" :placeholder="$ts('module.system.oss.form.remark')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="ossStatus" :label="$ts('module.system.oss.ossStatus')" orientation="horizontal" :ui="formItemUi">
            <URadioGroup v-model="statusValue" orientation="horizontal" :items="statusItems" />
          </UFormField>
        </div>
        <USeparator class="p-4" />
        <div class="flex justify-end gap-2">
          <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" @click="closeDrawer" />
          <UButton :label="$ts('common.confirm')" color="primary" type="submit" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
