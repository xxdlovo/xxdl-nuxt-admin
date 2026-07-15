<script setup lang="ts">
import {
  type SysMenuAddDTO,
  SysMenuAddSchema,
  type SysMenuUpdateDTO,
  SysMenuUpdateSchema,
  type SysMenuDto
} from "#shared/system/menu";

import type { FormSubmitEvent } from '@nuxt/ui'
import { useTransformRecordToOption } from "~/composables/useTransformRecordToOption";
import { enableStatusRecord, menuTypeRecord } from "#shared/constants/business";
import { useToastSuccess } from "~/utils/toast";
const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const props = defineProps<{
  visible: boolean;
  operateType: string;
  data?: SysMenuDto;
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
const typeValue = computed({
  get: () => String(state.value.type || 1),
  set: (val) => state.value.type = Number(val)
});
const state = ref<SysMenuAddDTO | SysMenuUpdateDTO>({
  id: '',
  parentId: '',
  name: '',
  code: '',
  type: 1,
  path: '',
  component: '',
  icon: '',
  sortOrder: 0,
  visible: 1,
  status: 1,
  remark: ''
})

const { schema, validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysMenuAddSchema : SysMenuUpdateSchema
})
const statusItems = useTransformRecordToOption(enableStatusRecord)
const typeItems = useTransformRecordToOption(menuTypeRecord)
const closeDrawer = () => {
  props.close?.()
}

// 初始化表单数据
const initFormData = () => {
  if (props.operateType === 'edit' && props.data) {
    // 编辑模式：填充表单数据
    Object.assign(state.value, {
      id: props.data.id,
      parentId: props.data.parentId || '',
      name: props.data.name || '',
      code: props.data.code || '',
      type: props.data.type ?? 1,
      path: props.data.path || '',
      component: props.data.component || '',
      icon: props.data.icon || '',
      sortOrder: props.data.sortOrder ?? 0,
      visible: props.data.visible ?? 1,
      status: props.data.status ?? 1,
      remark: props.data.remark || ''
    })
  } else if (props.operateType === 'add') {
    // 新增模式：重置表单
    Object.assign(state.value, {
      id: '',
      parentId: '',
      name: '',
      code: '',
      type: 1,
      path: '',
      component: '',
      icon: '',
      sortOrder: 0,
      visible: 1,
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

const handleSubmit = async (event: FormSubmitEvent<SysMenuAddDTO>) => {
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
  await $trpc.sysMenu.update.mutate(state.value as SysMenuUpdateDTO)
  useToastSuccess($ts('common.modifySuccess'))
}
// 保存数据
const handleSave = async () => {
  await $trpc.sysMenu.create.mutate(state.value)
  useToastSuccess($ts('common.addSuccess'))
}

const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.system.menu.addMenu'),
    edit: $ts('module.system.menu.editMenu')
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
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-x-6 gap-y-6">
          <UFormField name="name" required :label="$ts('module.system.menu.menuName')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.name" :placeholder="$ts('module.system.menu.form.menuName')" trailing="clear" />
          </UFormField>
          <UFormField name="code" required :label="$ts('module.system.menu.routeName')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.code" :placeholder="$ts('module.system.menu.form.routeName')" trailing="clear" />
          </UFormField>
          <UFormField name="type" required :label="$ts('module.system.menu.menuType')" orientation="horizontal"
            :ui="formItemUi">
            <URadioGroup orientation="horizontal" v-model="typeValue"
              :placeholder="$ts('module.system.menu.form.menuType')" :items="typeItems"></URadioGroup>
          </UFormField>
          <UFormField name="parentId" :label="$ts('module.system.menu.parentId')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.parentId" :placeholder="$ts('module.system.menu.form.menuName')" trailing="clear" />
          </UFormField>
          <UFormField name="path" :label="$ts('module.system.menu.routePath')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.path" :placeholder="$ts('module.system.menu.form.routePath')" trailing="clear" />
          </UFormField>
          <UFormField name="icon" :label="$ts('module.system.menu.icon')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.icon" :placeholder="$ts('module.system.menu.form.icon')" trailing="clear" />
          </UFormField>
          <UFormField name="component" :label="$ts('module.system.menu.page')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.component" :placeholder="$ts('module.system.menu.form.page')" trailing="clear" />
          </UFormField>
          <UFormField name="sortOrder" :label="$ts('module.system.menu.order')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.sortOrder" type="number" :placeholder="$ts('module.system.menu.form.order')" trailing="clear" />
          </UFormField>
          <UFormField name="status" :label="$ts('module.system.menu.menuStatus')" orientation="horizontal"
            :ui="formItemUi">
            <URadioGroup orientation="horizontal" v-model="statusValue"
              :placeholder="$ts('module.system.menu.form.menuStatus')" :items="statusItems"></URadioGroup>
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
