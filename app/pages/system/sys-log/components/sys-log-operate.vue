<script setup lang="ts">

import {
  type SysLogAddDTO,
  SysLogAddSchema,
  type SysLogUpdateDTO,
  SysLogUpdateSchema,
  type SysLogDto
} from "#shared/system/SysLog";

import type { FormSubmitEvent } from '@nuxt/ui'
import { businessDictCode } from "#shared/constants/business";
import { useToastSuccess } from "~/utils/toast";
const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const props = defineProps<{
  visible: boolean;
  operateType: string;
  data?: SysLogDto;
  close?: () => void;
  refresh?: () => void;
}>();

const formItemUi = {
  root: 'flex items-center',
  label: 'w-16 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>();

const visible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
});

const levelValue = computed({
  get: () => String(state.value.level || 0),
  set: (val) => state.value.level = Number(val)
});
const statusValue = computed({
  get: () => String(state.value.status || 0),
  set: (val) => state.value.status = Number(val)
});
const state = ref<SysLogAddDTO | SysLogUpdateDTO>({
  id: '',
  level: 0,
  module: '',
  message: '',
  trace: '',
  status: 1,
  remark: ''
})

const { schema, validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysLogAddSchema : SysLogUpdateSchema
})
const levelItems = useDictOptions(businessDictCode.sysLogLevel)
const statusItems = useDictOptions(businessDictCode.jobLogStatus, [1, 2])
const closeDrawer = () => {
  props.close?.()
}

// 初始化表单数据
const initFormData = () => {
  if (props.operateType === 'edit' && props.data) {
    // 编辑模式：填充表单数据
    Object.assign(state.value, {
      id: props.data.id,
      level: props.data.level ?? 0,
      module: props.data.module || '',
      message: props.data.message || '',
      trace: props.data.trace || '',
      status: props.data.status ?? 1,
      remark: props.data.remark || ''
    })
  } else if (props.operateType === 'add') {
    // 新增模式：重置表单
    Object.assign(state.value, {
      id: '',
      level: 0,
      module: '',
      message: '',
      trace: '',
      status: 1,
      remark: ''
    })
  }
}

// 每次打开时重新初始化
watch(visible, (newVal) => {
  if (newVal) {
    initFormData()
  }
})

const handleSubmit = async (event: FormSubmitEvent<SysLogAddDTO>) => {
  if (props.operateType === 'add') {
    await handleSave()
  } else if (props.operateType === 'edit') {
    await handleEdit()
  }
  closeDrawer()
  props.refresh?.()
}

// 编辑数据
const handleEdit = async () => {
  await $trpc.systemLog.update.mutate(state.value as SysLogUpdateDTO)
  useToastSuccess($ts('common.modifySuccess'))
}
// 保存数据
const handleSave = async () => {
  await $trpc.systemLog.create.mutate(state.value)
  useToastSuccess($ts('common.addSuccess'))
}

const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.system.sysLog.addSysLog'),
    edit: $ts('module.system.sysLog.editSysLog')
  };
  return titles[props.operateType];
});
</script>
<template>
  <UModal v-model:open="visible" :title="title" :dismissible="false" :ui="{
    content: 'max-w-[30%]',
    footer: 'justify-end'
  }">

    <template #body class="w-[50%]">
      <UForm ref="form" :validate="validate" :state="state" class="p-2" @submit="handleSubmit">
        <div class=" grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2   gap-x-6 gap-y-6">
          <UFormField name="level" required :label="$ts('module.system.sysLog.logLevel')" orientation="horizontal"
            :ui="formItemUi">
            <USelect v-model.nullable="levelValue" :placeholder="$ts('module.system.sysLog.form.logLevel')" :items="levelItems" />
          </UFormField>
          <UFormField name="module" :label="$ts('module.system.sysLog.logModule')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.module" :placeholder="$ts('module.system.sysLog.form.logModule')" trailing="clear" />
          </UFormField>
          <UFormField name="message" required :label="$ts('module.system.sysLog.logMessage')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.message" :placeholder="$ts('module.system.sysLog.form.logMessage')" trailing="clear" />
          </UFormField>
          <UFormField name="trace" :label="$ts('module.system.sysLog.logTrace')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.trace" :placeholder="$ts('module.system.sysLog.form.logTrace')" trailing="clear" />
          </UFormField>
          <UFormField name="remark" :label="$ts('module.system.sysLog.remark')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.remark" placeholder="-" trailing="clear" />
          </UFormField>
          <UFormField name="logStatus" :label="$ts('module.system.sysLog.logStatus')" orientation="horizontal"
            :ui="formItemUi">
            <URadioGroup orientation="horizontal" v-model="statusValue"
              :placeholder="$ts('module.system.sysLog.form.logStatus')" :items="statusItems"></URadioGroup>
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
