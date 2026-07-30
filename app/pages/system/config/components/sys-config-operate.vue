<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import {
  SysConfigAddSchema,
  type SysConfigAddDTO,
  type SysConfigDto,
  SysConfigUpdateSchema,
  type SysConfigUpdateDTO
} from '#shared/system/config'
import { businessDictCode } from '#shared/constants/business'
import { useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const props = defineProps<{
  visible: boolean
  operateType: string
  data?: SysConfigDto
  close?: () => void
  refresh?: () => void
}>()
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()
const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})
const state = ref<SysConfigAddDTO | SysConfigUpdateDTO>({
  id: '',
  configName: '',
  configKey: '',
  configValue: '',
  configType: 1,
  status: 1,
  remark: ''
})
const { validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysConfigAddSchema : SysConfigUpdateSchema
})
const statusItems = useDictOptions(businessDictCode.enableStatus)
const configTypeItems = computed(() => [
  { label: $ts('module.system.config.type.system'), value: '1' },
  { label: $ts('module.system.config.type.custom'), value: '2' }
])
const configTypeValue = computed({
  get: () => String(state.value.configType ?? 1),
  set: value => state.value.configType = Number(value)
})
const statusValue = computed({
  get: () => String(state.value.status ?? 1),
  set: value => state.value.status = Number(value)
})
const configNameValue = computed({
  get: () => state.value.configName ?? '',
  set: value => state.value.configName = value || undefined
})
const remarkValue = computed({
  get: () => state.value.remark ?? '',
  set: value => state.value.remark = value || undefined
})
const formItemUi = {
  root: 'flex items-center',
  label: 'w-24 shrink-0 pr-2 text-right',
  container: 'flex-1'
}

const resetState = () => {
  Object.assign(state.value, {
    id: '',
    configName: '',
    configKey: '',
    configValue: '',
    configType: 1,
    status: 1,
    remark: ''
  })
}

const initFormData = () => {
  resetState()
  if (props.operateType === 'edit' && props.data) {
    Object.assign(state.value, {
      id: props.data.id ?? '',
      configName: props.data.configName ?? '',
      configKey: props.data.configKey ?? '',
      configValue: props.data.configValue ?? '',
      configType: props.data.configType ?? 1,
      status: props.data.status ?? 1,
      remark: props.data.remark ?? ''
    })
  }
}

watch(visible, value => {
  if (value) initFormData()
})

const handleSubmit = async (_event: FormSubmitEvent<SysConfigAddDTO>) => {
  if (props.operateType === 'add') {
    await $trpc.sysConfig.create.mutate(state.value as SysConfigAddDTO)
    useToastSuccess($ts('common.addSuccess'))
  } else {
    await $trpc.sysConfig.update.mutate(state.value as SysConfigUpdateDTO)
    useToastSuccess($ts('common.modifySuccess'))
  }
  props.close?.()
  props.refresh?.()
}

const title = computed(() => props.operateType === 'add'
  ? $ts('module.system.config.addSysConfig')
  : $ts('module.system.config.editSysConfig'))
</script>

<template>
  <UModal v-model:open="visible" :title="title" :dismissible="false" :ui="{ content: 'max-w-[720px]', footer: 'justify-end' }">
    <template #body>
      <UForm :validate="validate" :state="state" class="p-2" @submit="handleSubmit">
        <div class="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
          <UFormField name="configName" :label="$ts('module.system.config.configName')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="configNameValue" :placeholder="$ts('module.system.config.form.configName')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="configKey" required :label="$ts('module.system.config.configKey')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.configKey" :placeholder="$ts('module.system.config.form.configKey')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="configValue" required :label="$ts('module.system.config.configValue')" orientation="horizontal" :ui="formItemUi" class="sm:col-span-2">
            <UTextarea v-model="state.configValue" :placeholder="$ts('module.system.config.form.configValue')" :rows="3" class="w-full" />
          </UFormField>
          <UFormField name="configType" :label="$ts('module.system.config.configType')" orientation="horizontal" :ui="formItemUi">
            <URadioGroup v-model="configTypeValue" :items="configTypeItems" orientation="horizontal" />
          </UFormField>
          <UFormField name="status" :label="$ts('module.system.config.status')" orientation="horizontal" :ui="formItemUi">
            <URadioGroup v-model="statusValue" :items="statusItems" orientation="horizontal" />
          </UFormField>
          <UFormField name="remark" :label="$ts('module.system.config.remark')" orientation="horizontal" :ui="formItemUi" class="sm:col-span-2">
            <UTextarea v-model="remarkValue" :placeholder="$ts('module.system.config.form.remark')" :rows="3" class="w-full" />
          </UFormField>
        </div>
        <USeparator class="p-4" />
        <div class="flex justify-end gap-2">
          <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" @click="props.close?.()" />
          <UButton :label="$ts('common.confirm')" color="primary" type="submit" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
