<script setup lang="ts">

import {
  type SysUserRoleAddDTO,
  SysUserRoleAddSchema,
  type SysUserRoleUpdateDTO,
  SysUserRoleUpdateSchema,
  type SysUserRoleDto
} from "#shared/system/userRole";

import type { FormSubmitEvent } from '@nuxt/ui'
import { businessDictCode } from "#shared/constants/business";
import { useToastSuccess } from "~/utils/toast";
const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const props = defineProps<{
  visible: boolean;
  operateType: string;
  data?: SysUserRoleDto;
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
const state = ref<SysUserRoleAddDTO | SysUserRoleUpdateDTO>({
  id: '',
  userId: '',
  roleId: '',
  status: 1,
  remark: ''
})

const { schema, validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysUserRoleAddSchema : SysUserRoleUpdateSchema
})
const statusItems = useDictOptions(businessDictCode.enableStatus)
const closeDrawer = () => {
  props.close?.()
}

// 初始化表单数据
const initFormData = () => {
  if (props.operateType === 'edit' && props.data) {
    // 编辑模式：填充表单数据
    Object.assign(state.value, {
      id: props.data.id,
      userId: props.data.userId || '',
      roleId: props.data.roleId || '',
      status: props.data.status ?? 1,
      remark: props.data.remark || ''
    })
  } else if (props.operateType === 'add') {
    // 新增模式：重置表单
    Object.assign(state.value, {
      id: '',
      userId: '',
      roleId: '',
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

const handleSubmit = async (event: FormSubmitEvent<SysUserRoleAddDTO>) => {
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
  await $trpc.sysUserRole.update.mutate(state.value as SysUserRoleUpdateDTO)
  useToastSuccess($ts('common.modifySuccess'))
}
// 保存数据
const handleSave = async () => {
  await $trpc.sysUserRole.create.mutate(state.value)
  useToastSuccess($ts('common.addSuccess'))
}

const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.system.userRole.addUserRole'),
    edit: $ts('module.system.userRole.editUserRole')
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
          <UFormField name="userId" required :label="$ts('module.system.userRole.userId')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.userId" :placeholder="$ts('module.system.userRole.form.userId')" trailing="clear" />
          </UFormField>
          <UFormField name="roleId" required :label="$ts('module.system.userRole.roleId')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.roleId" :placeholder="$ts('module.system.userRole.form.roleId')" trailing="clear" />
          </UFormField>
          <UFormField name="remark" :label="$ts('module.system.userRole.remark')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.remark" placeholder="-" trailing="clear" />
          </UFormField>
          <UFormField name="userRoleStatus" :label="$ts('module.system.userRole.userRoleStatus')" orientation="horizontal"
            :ui="formItemUi">
            <URadioGroup orientation="horizontal" v-model="statusValue"
              :placeholder="$ts('module.system.userRole.form.userRoleStatus')" :items="statusItems"></URadioGroup>
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
