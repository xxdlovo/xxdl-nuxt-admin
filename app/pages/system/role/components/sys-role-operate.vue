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
import RolePermissionAssignModal from './RolePermissionAssignModal.vue'
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
  root: 'flex flex-col gap-1 sm:flex-row sm:items-center',
  label: 'sm:w-16 sm:text-right sm:pr-2 flex-shrink-0',
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
  dataScope: '5',
  description: '',
  sortOrder: 0,
  status: 1,
  remark: ''
})

const { schema, validate } = useZodValidation({
  schema: () => (props.operateType === 'add' ? SysRoleAddSchema : SysRoleUpdateSchema) as any
})
const statusItems = useTransformRecordToOption(enableStatusRecord)
const permissionAssignVisible = ref(false)
const permissionAssignType = ref<'menu' | 'button'>('menu')
const permissionAssignRole = computed<SysRoleDto | null>(() => {
  if (props.operateType !== 'edit' || !state.value.id) {
    return null
  }

  return {
    ...props.data,
    ...state.value,
    id: state.value.id
  } as SysRoleDto
})
const closeDrawer = () => {
  props.close?.()
}

function openPermissionAssign(assignType: 'menu' | 'button') {
  permissionAssignType.value = assignType
  permissionAssignVisible.value = true
}

// 初始化表单数据
const initFormData = () => {
  if (props.operateType === 'edit' && props.data) {
    // 编辑模式：填充表单数据
    Object.assign(state.value, {
      id: props.data.id,
      name: props.data.name || '',
      code: props.data.code || '',
      dataScope: props.data.dataScope ?? '5',
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
      dataScope: '5',
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
    content: 'w-[calc(100vw-2rem)] max-w-[720px] overflow-hidden',
    body: 'p-4 sm:p-6 overflow-hidden',
    footer: 'justify-end gap-2 border-t border-default p-4 sm:px-6'
  }">

    <template #body>
      <UForm id="sys-role-form" ref="form" :validate="validate" :state="state" class="max-h-[min(70vh,560px)] overflow-y-auto p-1" @submit="handleSubmit">
        <div class="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-2">
          <UFormField name="name" required :label="$ts('module.system.role.roleName')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.name" :placeholder="$ts('module.system.role.form.roleName')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="code" required :label="$ts('module.system.role.roleCode')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.code" :placeholder="$ts('module.system.role.form.roleCode')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="description" :label="$ts('module.system.role.roleDesc')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.description" :placeholder="$ts('module.system.role.form.roleDesc')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="sortOrder" :label="$ts('module.system.role.sortOrder')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.sortOrder" type="number" placeholder="0" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="remark" :label="$ts('module.system.role.remark')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.remark" placeholder="-" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="roleStatus" :label="$ts('module.system.role.roleStatus')" orientation="horizontal"
            :ui="formItemUi">
            <URadioGroup orientation="horizontal" v-model="statusValue"
              :placeholder="$ts('module.system.role.form.roleStatus')" :items="statusItems"></URadioGroup>
          </UFormField>
        </div>
        <USeparator class="p-4" />
        <div v-if="props.operateType === 'edit'" class="mb-4 rounded-md border border-default p-3">
          <div class="mb-3 flex items-center gap-2 text-sm font-medium text-highlighted">
            <UIcon name="i-lucide-shield-check" class="size-4" />
            <span>{{ $ts('module.system.role.menuAuth') }} / {{ $ts('module.system.role.buttonAuth') }}</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton
              :label="$ts('module.system.role.menuAuth')"
              icon="i-lucide-menu"
              color="neutral"
              variant="outline"
              @click="openPermissionAssign('menu')"
            />
            <UButton
              :label="$ts('module.system.role.buttonAuth')"
              icon="i-lucide-square-check"
              color="neutral"
              variant="outline"
              @click="openPermissionAssign('button')"
            />
          </div>
        </div>
      </UForm>

    </template>
    <template #footer>
      <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" @click="closeDrawer" />
      <UButton :label="$ts('common.confirm')" color="primary" type="submit" form="sys-role-form" />
    </template>
  </UModal>

  <RolePermissionAssignModal
    v-if="permissionAssignVisible && permissionAssignRole"
    v-model:open="permissionAssignVisible"
    :role="permissionAssignRole"
    :assign-type="permissionAssignType"
  />
</template>
