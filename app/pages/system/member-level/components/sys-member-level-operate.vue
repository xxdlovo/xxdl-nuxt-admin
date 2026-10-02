<script setup lang="ts">
import {
  type SysMemberLevelAddDTO,
  SysMemberLevelAddSchema,
  type SysMemberLevelDto,
  type SysMemberLevelUpdateDTO,
  SysMemberLevelUpdateSchema
} from '#shared/system/memberLevel'
import type { FormSubmitEvent } from '@nuxt/ui'
import { useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const props = defineProps<{
  visible: boolean
  operateType: string
  data?: SysMemberLevelDto
  close?: () => void
  refresh?: () => void
}>()

const formItemUi = {
  root: 'flex items-center',
  label: 'w-32 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const state = ref<SysMemberLevelAddDTO | SysMemberLevelUpdateDTO>({
  id: '',
  code: '',
  name: '',
  sortOrder: 0,
  benefit: '',
  status: 1,
  remark: ''
})

const { validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysMemberLevelAddSchema : SysMemberLevelUpdateSchema
})

// 可空字段的统一适配：避免 null 直接绑到输入组件
const benefitValue = computed({
  get: () => state.value.benefit ?? '',
  set: value => state.value.benefit = value
})
const remarkValue = computed({
  get: () => state.value.remark ?? '',
  set: value => state.value.remark = value
})

const closeDrawer = () => {
  props.close?.()
}

const resetState = () => {
  Object.assign(state.value, {
    id: '',
    code: '',
    name: '',
    sortOrder: 0,
    benefit: '',
    status: 1,
    remark: ''
  })
}

const initFormData = () => {
  resetState()

  if (props.operateType === 'edit' && props.data) {
    Object.assign(state.value, {
      id: props.data.id ?? '',
      code: props.data.code || '',
      name: props.data.name || '',
      sortOrder: props.data.sortOrder ?? 0,
      benefit: props.data.benefit || '',
      status: props.data.status ?? 1,
      remark: props.data.remark || ''
    })
  }
}

watch(visible, (opened) => {
  if (opened) {
    initFormData()
  }
})

const handleSubmit = async (_event: FormSubmitEvent<SysMemberLevelAddDTO>) => {
  if (props.operateType === 'add') {
    await $trpc.sysMemberLevel.create.mutate(state.value as SysMemberLevelAddDTO)
    useToastSuccess($ts('common.addSuccess'))
  } else {
    await $trpc.sysMemberLevel.update.mutate(state.value as SysMemberLevelUpdateDTO)
    useToastSuccess($ts('common.modifySuccess'))
  }

  closeDrawer()
  props.refresh?.()
}

const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.system.memberLevel.addSysMemberLevel'),
    edit: $ts('module.system.memberLevel.editSysMemberLevel')
  }

  return titles[props.operateType]
})
</script>

<template>
  <UModal v-model:open="visible" :title="title" :dismissible="false" :ui="{
    content: 'w-[calc(100vw-2rem)] max-w-[760px]',
    footer: 'justify-end gap-2 border-t border-default p-4 sm:px-6'
  }">
    <template #body>
      <UForm ref="form" :validate="validate" :state="state" class="p-2" @submit="handleSubmit">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-6">
          <UFormField name="code" required :label="$ts('module.system.memberLevel.code')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.code" :placeholder="$ts('module.system.memberLevel.form.code')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="name" required :label="$ts('module.system.memberLevel.name')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.name" :placeholder="$ts('module.system.memberLevel.form.name')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="sortOrder" :label="$ts('module.system.memberLevel.sortOrder')" orientation="horizontal" :ui="formItemUi">
            <UInputNumber v-model="state.sortOrder" :min="0" class="w-full" />
          </UFormField>
          <UFormField name="status" :label="$ts('module.system.memberLevel.statusLabel')" orientation="horizontal" :ui="formItemUi">
            <USwitch v-model="state.status" :true-value="1" :false-value="0" />
          </UFormField>
        </div>

        <UFormField name="benefit" :label="$ts('module.system.memberLevel.benefit')" orientation="horizontal" :ui="formItemUi" class="mt-5">
          <UTextarea v-model="benefitValue" :rows="3" :placeholder="$ts('module.system.memberLevel.form.benefit')" class="w-full" />
        </UFormField>

        <UFormField name="remark" :label="$ts('module.system.memberLevel.remark')" orientation="horizontal" :ui="formItemUi" class="mt-5">
          <UTextarea v-model="remarkValue" :rows="2" :placeholder="$ts('module.system.memberLevel.form.remark')" class="w-full" />
        </UFormField>

        <USeparator class="my-5" />
        <div class="flex justify-end gap-2">
          <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" @click="closeDrawer" />
          <UButton :label="$ts('common.confirm')" color="primary" type="submit" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
