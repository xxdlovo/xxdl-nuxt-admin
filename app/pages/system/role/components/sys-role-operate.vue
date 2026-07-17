<script setup lang="ts">

import {
  type SysRoleAddDTO,
  SysRoleAddSchema,
  type SysRoleUpdateDTO,
  SysRoleUpdateSchema,
  type SysRoleDto
} from "#shared/system/role";

import type { FormSubmitEvent } from '@nuxt/ui'
import { useTransformRecordToOption } from "~/composables/useTransformRecordToOption";
import { enableStatusRecord } from "#shared/constants/business";
import { useToastSuccess } from "~/utils/toast";
const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const props = defineProps<{
  visible: boolean;
  operateType: string;
  data?: SysRoleDto;
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
const state = ref<SysRoleAddDTO | SysRoleUpdateDTO>({
  id: '',
  name: '',
  code: '',
  description: '',
  sortOrder: 0,
  status: 1,
  remark: ''
})

const { schema, validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysRoleAddSchema : SysRoleUpdateSchema
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
      description: props.data.description || '',
      sortOrder: props.data.sortOrder ?? 0,
      status: props.data.status ?? 1,
      remark: props.data.remark || ''
    })
  } else if (props.operateType === 'add') {
    // 新增模式：重置表单
    Object.assign(state.value, {
      id: '',
      name: '',
      code: '',
      description: '',
      sortOrder: 0,
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

const handleSubmit = async (event: FormSubmitEvent<SysRoleAddDTO>) => {
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
  await $trpc.sysRole.update.mutate(state.value as SysRoleUpdateDTO)
  useToastSuccess($ts('common.modifySuccess'))
}
// 保存数据
const handleSave = async () => {
  await $trpc.sysRole.create.mutate(state.value)
  useToastSuccess($ts('common.addSuccess'))
}

const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.system.role.addRole'),
    edit: $ts('module.system.role.editRole')
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
          <UFormField name="name" required :label="$ts('module.system.role.roleName')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.name" :placeholder="$ts('module.system.role.form.roleName')" trailing="clear" />
          </UFormField>
          <UFormField name="code" required :label="$ts('module.system.role.roleCode')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.code" :placeholder="$ts('module.system.role.form.roleCode')" trailing="clear" />
          </UFormField>
          <UFormField name="description" :label="$ts('module.system.role.roleDesc')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.description" :placeholder="$ts('module.system.role.form.roleDesc')" trailing="clear" />
          </UFormField>
          <UFormField name="sortOrder" :label="$ts('module.system.role.sortOrder')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.sortOrder" type="number" placeholder="0" trailing="clear" />
          </UFormField>
          <UFormField name="remark" :label="$ts('module.system.role.remark')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.remark" placeholder="-" trailing="clear" />
          </UFormField>
          <UFormField name="roleStatus" :label="$ts('module.system.role.roleStatus')" orientation="horizontal"
            :ui="formItemUi">
            <URadioGroup orientation="horizontal" v-model="statusValue"
              :placeholder="$ts('module.system.role.form.roleStatus')" :items="statusItems"></URadioGroup>
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
