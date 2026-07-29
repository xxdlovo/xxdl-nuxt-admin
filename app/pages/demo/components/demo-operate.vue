<script setup lang="ts">

import {
  type DemoAddDTO,
  DemoAddSchema,
  type DemoQueryDTO,
  DemoQuerySchema,
  type DemoUpdateDTO,
  DemoUpdateSchema,
  type DemoDto
} from "#shared/demo";

import type { FormSubmitEvent } from '@nuxt/ui'
import { businessDictCode } from "#shared/constants/business";
import { useToastSuccess } from "~/utils/toast";
const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const props = defineProps<{
  visible: boolean;
  operateType: string;
  data?: DemoDto;
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
const state = ref<DemoAddDTO | DemoUpdateDTO>({
  id: '',
  field1: '',
  field2: '',
  status: 1,
  remark: ''
})

const { schema, validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? DemoAddSchema : DemoUpdateSchema
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
      field1: props.data.field1 || '',
      field2: props.data.field2 || '',
      status: props.data.status ?? 1,
      remark: props.data.remark || ''
    })
  } else if (props.operateType === 'add') {
    // 新增模式：重置表单
    Object.assign(state.value, {
      id: '',
      field1: '',
      field2: '',
      status: 1,
      remark: ''
    })
  }
}

// 监听 data 和 operateType 变化
// watch([() => props.data, () => props.operateType], () => {
//   initFormData()
// }, { immediate: true })

// 每次打开时重新初始化
watch(visible, (newVal) => {
  if (newVal) {
    initFormData()
  }
})

const handleSubmit = async (event: FormSubmitEvent<DemoAddDTO>) => {
  
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
  await $trpc.demo.update.mutate(state.value as DemoUpdateDTO)
  useToastSuccess($ts('common.modifySuccess'))
}
// 保存数据
const handleSave = async () => {
  console.log(state.value);
  
  await $trpc.demo.create.mutate(state.value)
  useToastSuccess($ts('common.addSuccess'))
}

const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.demo.addDemo'),
    edit: $ts('module.demo.editDemo')
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
          <UFormField name="field1" required :label="$ts('module.demo.field1')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.field1" :placeholder="$ts('module.demo.form.field1')" trailing="clear" />
          </UFormField>
          <UFormField name="field2" required :label="$ts('module.demo.field2')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.field2" :placeholder="$ts('module.demo.form.field2')" trailing="clear" />
          </UFormField>
          <UFormField name="demoStatus" :label="$ts('module.demo.demoStatus')" orientation="horizontal"
            :ui="formItemUi">
            <URadioGroup orientation="horizontal" v-model="statusValue"
              :placeholder="$ts('module.demo.form.demoStatus')" :items="statusItems"></URadioGroup>
          </UFormField>
        </div>
        <USeparator class="p-4" />
        <div class="flex justify-end gap-2">
          <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" @click="closeDrawer" />
          <UButton :label="$ts('common.confirm')" color="primary" type="submit" />
        </div>
      </UForm>

    </template>
    <!--    <template #footer="{ close }">-->

    <!--    </template>-->
  </UModal>
</template>
