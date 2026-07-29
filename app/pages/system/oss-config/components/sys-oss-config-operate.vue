<script setup lang="ts">
import {
  type SysOssConfigAddDTO,
  SysOssConfigAddSchema,
  type SysOssConfigUpdateDTO,
  SysOssConfigUpdateSchema,
  type SysOssConfigDto
} from '#shared/system/ossConfig'
import type { FormSubmitEvent } from '@nuxt/ui'
import { businessDictCode } from '#shared/constants/business'
import { useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const props = defineProps<{
  visible: boolean
  operateType: string
  data?: SysOssConfigDto
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

const state = ref<SysOssConfigAddDTO | SysOssConfigUpdateDTO>({
  id: '',
  configKey: '',
  configName: '',
  service: 'aliyun',
  endpoint: '',
  region: '',
  bucketName: '',
  accessKey: '',
  secretKey: '',
  domain: '',
  prefix: '',
  isHttps: 1,
  accessPolicy: 1,
  isDefault: 0,
  status: 1,
  remark: ''
})

const { validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysOssConfigAddSchema : SysOssConfigUpdateSchema
})
const statusItems = useDictOptions(businessDictCode.enableStatus)
const serviceItems = useDictOptions(businessDictCode.ossService)
const serviceValue = computed({
  get: () => state.value.service ?? undefined,
  set: value => state.value.service = value || ''
})
const booleanItems = useDictOptions(businessDictCode.noYes)
const accessPolicyItems = useDictOptions(businessDictCode.ossAccessPolicy)

const httpsValue = computed({
  get: () => String(state.value.isHttps ?? 1),
  set: val => state.value.isHttps = Number(val)
})
const accessPolicyValue = computed({
  get: () => String(state.value.accessPolicy ?? 1),
  set: val => state.value.accessPolicy = Number(val)
})
const defaultValue = computed({
  get: () => String(state.value.isDefault ?? 0),
  set: val => state.value.isDefault = Number(val)
})
const statusValue = computed({
  get: () => String(state.value.status ?? 1),
  set: val => state.value.status = Number(val)
})
const remarkValue = computed({
  get: () => state.value.remark ?? '',
  set: value => state.value.remark = value || ''
})

const closeDrawer = () => {
  props.close?.()
}

const resetState = () => {
  Object.assign(state.value, {
    id: '',
    configKey: '',
    configName: '',
    service: 'aliyun',
    endpoint: '',
    region: '',
    bucketName: '',
    accessKey: '',
    secretKey: '',
    domain: '',
    prefix: '',
    isHttps: 1,
    accessPolicy: 1,
    isDefault: 0,
    status: 1,
    remark: ''
  })
}

const initFormData = () => {
  resetState()
  if (props.operateType === 'edit' && props.data) {
    Object.assign(state.value, {
      id: props.data.id,
      configKey: props.data.configKey || '',
      configName: props.data.configName || '',
      service: props.data.service || 'aliyun',
      endpoint: props.data.endpoint || '',
      region: props.data.region || '',
      bucketName: props.data.bucketName || '',
      accessKey: props.data.accessKey || '',
      secretKey: props.data.secretKey || '',
      domain: props.data.domain || '',
      prefix: props.data.prefix || '',
      isHttps: props.data.isHttps ?? 1,
      accessPolicy: props.data.accessPolicy ?? 1,
      isDefault: props.data.isDefault ?? 0,
      status: props.data.status ?? 1,
      remark: props.data.remark || ''
    })
  }
}

watch(visible, (newVal) => {
  if (newVal) {
    initFormData()
  }
})

const handleSubmit = async (event: FormSubmitEvent<SysOssConfigAddDTO>) => {
  if (props.operateType === 'add') {
    await handleSave()
  } else if (props.operateType === 'edit') {
    await handleEdit()
  }
  closeDrawer()
  props.refresh?.()
}

const handleEdit = async () => {
  await $trpc.sysOssConfig.update.mutate(state.value as SysOssConfigUpdateDTO)
  useToastSuccess($ts('common.modifySuccess'))
}

const handleSave = async () => {
  await $trpc.sysOssConfig.create.mutate(state.value)
  useToastSuccess($ts('common.addSuccess'))
}

const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.system.ossConfig.addSysOssConfig'),
    edit: $ts('module.system.ossConfig.editSysOssConfig')
  }
  return titles[props.operateType]
})
</script>

<template>
  <UModal v-model:open="visible" :title="title" :dismissible="false" :ui="{
    content: 'max-w-[860px]',
    footer: 'justify-end'
  }">
    <template #body>
      <UForm ref="form" :validate="validate" :state="state" class="p-2" @submit="handleSubmit">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
          <UFormField name="configKey" required :label="$ts('module.system.ossConfig.configKey')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.configKey" :placeholder="$ts('module.system.ossConfig.form.configKey')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="configName" required :label="$ts('module.system.ossConfig.configName')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.configName" :placeholder="$ts('module.system.ossConfig.form.configName')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="service" required :label="$ts('module.system.ossConfig.service')" orientation="horizontal" :ui="formItemUi">
            <USelect v-model="serviceValue" :items="serviceItems" :placeholder="$ts('module.system.ossConfig.form.service')" class="w-full" />
          </UFormField>
          <UFormField name="endpoint" :label="$ts('module.system.ossConfig.endpoint')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.endpoint" :placeholder="$ts('module.system.ossConfig.form.endpoint')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="region" :label="$ts('module.system.ossConfig.region')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.region" :placeholder="$ts('module.system.ossConfig.form.region')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="bucketName" :label="$ts('module.system.ossConfig.bucketName')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.bucketName" :placeholder="$ts('module.system.ossConfig.form.bucketName')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="accessKey" :label="$ts('module.system.ossConfig.accessKey')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.accessKey" :placeholder="$ts('module.system.ossConfig.form.accessKey')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="secretKey" :label="$ts('module.system.ossConfig.secretKey')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.secretKey" :placeholder="$ts('module.system.ossConfig.form.secretKey')" trailing="password" class="w-full" />
          </UFormField>
          <UFormField name="domain" :label="$ts('module.system.ossConfig.domain')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.domain" :placeholder="$ts('module.system.ossConfig.form.domain')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="prefix" :label="$ts('module.system.ossConfig.prefix')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.prefix" :placeholder="$ts('module.system.ossConfig.form.prefix')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="isHttps" :label="$ts('module.system.ossConfig.isHttps')" orientation="horizontal" :ui="formItemUi">
            <URadioGroup v-model="httpsValue" orientation="horizontal" :items="booleanItems" />
          </UFormField>
          <UFormField name="accessPolicy" :label="$ts('module.system.ossConfig.accessPolicy')" orientation="horizontal" :ui="formItemUi">
            <URadioGroup v-model="accessPolicyValue" orientation="horizontal" :items="accessPolicyItems" />
          </UFormField>
          <UFormField name="isDefault" :label="$ts('module.system.ossConfig.isDefault')" orientation="horizontal" :ui="formItemUi">
            <URadioGroup v-model="defaultValue" orientation="horizontal" :items="booleanItems" />
          </UFormField>
          <UFormField name="configStatus" :label="$ts('module.system.ossConfig.configStatus')" orientation="horizontal" :ui="formItemUi">
            <URadioGroup v-model="statusValue" orientation="horizontal" :items="statusItems" />
          </UFormField>
          <UFormField name="remark" :label="$ts('module.system.ossConfig.remark')" orientation="horizontal" :ui="formItemUi" class="sm:col-span-2">
            <UTextarea v-model="remarkValue" :placeholder="$ts('module.system.ossConfig.form.remark')" :rows="3" class="w-full" />
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
