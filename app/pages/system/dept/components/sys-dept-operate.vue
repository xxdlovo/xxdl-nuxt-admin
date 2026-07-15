<script setup lang="ts">

import {
  type SysDeptAddDTO,
  SysDeptAddSchema,
  type SysDeptUpdateDTO,
  SysDeptUpdateSchema,
  type SysDeptDto
} from "#shared/system/department";

import type { FormSubmitEvent } from '@nuxt/ui'
import { useTransformRecordToOption } from "~/composables/useTransformRecordToOption";
import { enableStatusRecord } from "#shared/constants/business";
import { useToastSuccess } from "~/utils/toast";
const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const props = defineProps<{
  visible: boolean;
  operateType: string;
  data?: SysDeptDto;
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
const state = ref<SysDeptAddDTO | SysDeptUpdateDTO>({
  id: '',
  name: '',
  code: '',
  parentId: '',
  path: '',
  level: 0,
  sortOrder: 0,
  leader: '',
  phone: '',
  email: '',
  status: 1,
  remark: ''
})

const { schema, validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysDeptAddSchema : SysDeptUpdateSchema
})
const statusItems = useTransformRecordToOption(enableStatusRecord)
const closeDrawer = () => {
  props.close?.()
}

// 初始化表单数据
const initFormData = () => {
  
  if (props.operateType === 'edit' && props.data) {
    // 编辑模式：填充表单数据
    Object.assign(state.value, {
      id: props.data.id,
      name: props.data.name || '',
      code: props.data.code || '',
      parentId: props.data.parentId || '',
      path: props.data.path || '',
      level: props.data.level ?? 0,
      sortOrder: props.data.sortOrder ?? 0,
      leader: props.data.leader || '',
      phone: props.data.phone || '',
      email: props.data.email || '',
      status: props.data.status ?? 1,
      remark: props.data.remark || ''
    })
  } else if (props.operateType === 'add') {
    // 新增模式：重置表单
    Object.assign(state.value, {
      id: '',
      name: '',
      code: '',
      parentId: '',
      path: '',
      level: 0,
      sortOrder: 0,
      leader: '',
      phone: '',
      email: '',
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

const handleSubmit = async (event: FormSubmitEvent<SysDeptAddDTO>) => {
  
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
  await $trpc.sysDept.update.mutate(state.value as SysDeptUpdateDTO)
  useToastSuccess($ts('common.modifySuccess'))
}
// 保存数据
const handleSave = async () => {
  await $trpc.sysDept.create.mutate(state.value)
  useToastSuccess($ts('common.addSuccess'))
}

const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.system.department.addDept'),
    edit: $ts('module.system.department.editDept')
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
          <UFormField name="name" required :label="$ts('module.system.department.deptName')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.name" :placeholder="$ts('module.system.department.form.deptName')" trailing="clear" />
          </UFormField>
          <UFormField name="code" required :label="$ts('module.system.department.deptCode')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.code" :placeholder="$ts('module.system.department.form.deptCode')" trailing="clear" />
          </UFormField>
          <UFormField name="parentId" :label="$ts('module.system.department.parentDept')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.parentId" :placeholder="$ts('module.system.department.form.parentDept')" trailing="clear" />
          </UFormField>
          <UFormField name="leader" :label="$ts('module.system.department.leader')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.leader" :placeholder="$ts('module.system.department.form.leader')" trailing="clear" />
          </UFormField>
          <UFormField name="phone" :label="$ts('module.system.department.phone')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.phone" :placeholder="$ts('module.system.department.form.phone')" trailing="clear" />
          </UFormField>
          <UFormField name="email" :label="$ts('module.system.department.email')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.email" :placeholder="$ts('module.system.department.form.email')" trailing="clear" />
          </UFormField>
          <UFormField name="sortOrder" :label="$ts('module.system.department.sortOrder')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.sortOrder" type="number" :placeholder="$ts('module.system.department.form.sortOrder')" trailing="clear" />
          </UFormField>
          <UFormField name="deptStatus" :label="$ts('module.system.department.deptStatus')" orientation="horizontal"
            :ui="formItemUi">
            <URadioGroup orientation="horizontal" v-model="statusValue"
              :placeholder="$ts('module.system.department.form.deptStatus')" :items="statusItems"></URadioGroup>
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
