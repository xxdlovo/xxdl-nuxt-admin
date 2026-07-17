<script setup lang="ts">

import {
  type SysLoginLogAddDTO,
  SysLoginLogAddSchema,
  type SysLoginLogUpdateDTO,
  SysLoginLogUpdateSchema,
  type SysLoginLogDto
} from "#shared/system/loginLog";

import type { FormSubmitEvent } from '@nuxt/ui'
import { useTransformRecordToOption } from "~/composables/useTransformRecordToOption";
import { successFailureRecord } from "#shared/constants/business";
import { useToastSuccess } from "~/utils/toast";
const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const props = defineProps<{
  visible: boolean;
  operateType: string;
  data?: SysLoginLogDto;
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

const statusValue = computed({
  get: () => String(state.value.status || 0),
  set: (val) => state.value.status = Number(val)
});
const state = ref<SysLoginLogAddDTO | SysLoginLogUpdateDTO>({
  id: '',
  username: '',
  ip: '',
  location: '',
  browser: '',
  os: '',
  userAgent: '',
  status: 1,
  remark: ''
})

const { schema, validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysLoginLogAddSchema : SysLoginLogUpdateSchema
})
const statusItems = useTransformRecordToOption(successFailureRecord)
const closeDrawer = () => {
  props.close?.()
}

// 初始化表单数据
const initFormData = () => {
  if (props.operateType === 'edit' && props.data) {
    // 编辑模式：填充表单数据
    Object.assign(state.value, {
      id: props.data.id,
      username: props.data.username || '',
      ip: props.data.ip || '',
      location: props.data.location || '',
      browser: props.data.browser || '',
      os: props.data.os || '',
      userAgent: props.data.userAgent || '',
      status: props.data.status ?? 1,
      remark: props.data.remark || ''
    })
  } else if (props.operateType === 'add') {
    // 新增模式：重置表单
    Object.assign(state.value, {
      id: '',
      username: '',
      ip: '',
      location: '',
      browser: '',
      os: '',
      userAgent: '',
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

const handleSubmit = async (event: FormSubmitEvent<SysLoginLogAddDTO>) => {
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
  await $trpc.sysLoginLog.update.mutate(state.value as SysLoginLogUpdateDTO)
  useToastSuccess($ts('common.modifySuccess'))
}
// 保存数据
const handleSave = async () => {
  await $trpc.sysLoginLog.create.mutate(state.value)
  useToastSuccess($ts('common.addSuccess'))
}

const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.system.loginLog.addSysLoginLog'),
    edit: $ts('module.system.loginLog.editSysLoginLog')
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
          <UFormField name="username" required :label="$ts('module.system.loginLog.username')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.username" :placeholder="$ts('module.system.loginLog.form.username')" trailing="clear" />
          </UFormField>
          <UFormField name="ip" required :label="$ts('module.system.loginLog.ip')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.ip" :placeholder="$ts('module.system.loginLog.form.ip')" trailing="clear" />
          </UFormField>
          <UFormField name="location" :label="$ts('module.system.loginLog.location')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.location" :placeholder="$ts('module.system.loginLog.form.location')" trailing="clear" />
          </UFormField>
          <UFormField name="browser" :label="$ts('module.system.loginLog.browser')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.browser" :placeholder="$ts('module.system.loginLog.form.browser')" trailing="clear" />
          </UFormField>
          <UFormField name="os" :label="$ts('module.system.loginLog.os')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.os" :placeholder="$ts('module.system.loginLog.form.os')" trailing="clear" />
          </UFormField>
          <UFormField name="loginStatus" :label="$ts('module.system.loginLog.loginStatus')" orientation="horizontal"
            :ui="formItemUi">
            <URadioGroup orientation="horizontal" v-model="statusValue"
              :placeholder="$ts('module.system.loginLog.form.loginStatus')" :items="statusItems"></URadioGroup>
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
