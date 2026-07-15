<script setup lang="ts">

import {
  type SysDictDataAddDTO,
  SysDictDataAddSchema,
  type SysDictDataUpdateDTO,
  SysDictDataUpdateSchema,
  type SysDictDataDto
} from "#shared/system/dictData";

import type { FormSubmitEvent } from '@nuxt/ui'
import { useTransformRecordToOption } from "~/composables/useTransformRecordToOption";
import { enableStatusRecord } from "#shared/constants/business";
import { useToastSuccess } from "~/utils/toast";
const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const props = defineProps<{
  visible: boolean;
  operateType: string;
  data?: SysDictDataDto;
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
const state = ref<SysDictDataAddDTO | SysDictDataUpdateDTO>({
  id: '',
  typeId: '',
  label: '',
  value: '',
  sortOrder: 0,
  status: 1,
  remark: ''
})

const { schema, validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysDictDataAddSchema : SysDictDataUpdateSchema
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
      typeId: props.data.typeId || '',
      label: props.data.label || '',
      value: props.data.value || '',
      sortOrder: props.data.sortOrder ?? 0,
      status: props.data.status ?? 1,
      remark: props.data.remark || ''
    })
  } else if (props.operateType === 'add') {
    // 新增模式：重置表单
    Object.assign(state.value, {
      id: '',
      typeId: '',
      label: '',
      value: '',
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

const handleSubmit = async (event: FormSubmitEvent<SysDictDataAddDTO>) => {
  
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
  await $trpc.sysDictData.update.mutate(state.value as SysDictDataUpdateDTO)
  useToastSuccess($ts('common.modifySuccess'))
}
// 保存数据
const handleSave = async () => {
  await $trpc.sysDictData.create.mutate(state.value)
  useToastSuccess($ts('common.addSuccess'))
}

const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.system.dictData.addDictData'),
    edit: $ts('module.system.dictData.editDictData')
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
          <UFormField name="typeId" required :label="$ts('module.system.dictData.typeId')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.typeId" :placeholder="$ts('module.system.dictData.form.typeId')" trailing="clear" />
          </UFormField>
          <UFormField name="label" required :label="$ts('module.system.dictData.label')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.label" :placeholder="$ts('module.system.dictData.form.label')" trailing="clear" />
          </UFormField>
          <UFormField name="value" required :label="$ts('module.system.dictData.value')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.value" :placeholder="$ts('module.system.dictData.form.value')" trailing="clear" />
          </UFormField>
          <UFormField name="sortOrder" :label="$ts('module.system.dictData.sortOrder')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.sortOrder" type="number" :placeholder="$ts('module.system.dictData.form.sortOrder')" trailing="clear" />
          </UFormField>
          <UFormField name="dictStatus" :label="$ts('module.system.dictData.dictStatus')" orientation="horizontal"
            :ui="formItemUi">
            <URadioGroup orientation="horizontal" v-model="statusValue"
              :placeholder="$ts('module.system.dictData.form.dictStatus')" :items="statusItems"></URadioGroup>
          </UFormField>
          <UFormField name="remark" :label="$ts('module.system.dictData.remark')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.remark" :placeholder="$ts('module.system.dictData.form.remark')" trailing="clear" />
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
