<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import {
  SysPostAddSchema,
  type SysPostAddDTO,
  type SysPostDto,
  SysPostUpdateSchema,
  type SysPostUpdateDTO,
} from '#admin/shared/system/post'
import { businessDictCode } from '#admin/shared/constants/business'
import { useToastSuccess } from '#admin/app/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const props = defineProps<{
  visible: boolean
  operateType: string
  data?: SysPostDto
  close?: () => void
  refresh?: () => void
}>()
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()
const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const state = ref<SysPostAddDTO | SysPostUpdateDTO>({
  id: '',
  code: '',
  name: '',
  sortOrder: 0,
  status: 1,
  remark: '',
})

const { validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysPostAddSchema : SysPostUpdateSchema
})
const statusItems = useDictOptions(businessDictCode.enableStatus)
const statusValue = computed({
  get: () => String(state.value.status ?? 1),
  set: value => state.value.status = Number(value)
})
const remarkValue = computed({
  get: () => state.value.remark ?? '',
  set: value => state.value.remark = value || undefined
})
const formItemUi = {
  root: 'flex items-center',
  label: 'w-24 shrink-0 pr-2 text-right',
  container: 'flex-1'
}

const resetState = () => {
  Object.assign(state.value, {
    id: '',
    code: '',
    name: '',
    sortOrder: 0,
    status: 1,
    remark: '',
  })
}

const initFormData = () => {
  resetState()
  if (props.operateType === 'edit' && props.data) {
    Object.assign(state.value, {
      id: props.data.id ?? '',
      code: props.data.code ?? '',
      name: props.data.name ?? '',
      sortOrder: props.data.sortOrder ?? 0,
      status: props.data.status ?? 1,
      remark: props.data.remark ?? '',
    })
  }
}

watch(visible, (value) => {
  if (value) initFormData()
})

const handleSubmit = async (_event: FormSubmitEvent<SysPostAddDTO>) => {
  if (props.operateType === 'add') {
    await $trpc.sysPost.create.mutate(state.value as SysPostAddDTO)
    useToastSuccess($ts('common.addSuccess'))
  }
  else {
    await $trpc.sysPost.update.mutate(state.value as SysPostUpdateDTO)
    useToastSuccess($ts('common.modifySuccess'))
  }
  props.close?.()
  props.refresh?.()
}

const title = computed(() => props.operateType === 'add'
  ? $ts('module.system.post.addPost')
  : $ts('module.system.post.editPost'))
</script>

<template>
  <UModal v-model:open="visible" :title="title" :dismissible="false" :ui="{ content: 'max-w-[720px]', footer: 'justify-end' }">
    <template #body>
      <UForm id="sys-post-form" :validate="validate" :state="state" class="p-2" @submit="handleSubmit">
        <div class="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
          <UFormField name="code" required :label="$ts('module.system.post.code')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.code" :placeholder="$ts('module.system.post.form.code')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="name" required :label="$ts('module.system.post.name')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.name" :placeholder="$ts('module.system.post.form.name')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="sortOrder" :label="$ts('module.system.post.sortOrder')" orientation="horizontal" :ui="formItemUi">
            <UInputNumber v-model="state.sortOrder" :min="0" class="w-full" />
          </UFormField>
          <UFormField name="status" :label="$ts('module.system.post.status')" orientation="horizontal" :ui="formItemUi">
            <URadioGroup v-model="statusValue" orientation="horizontal" :items="statusItems" />
          </UFormField>
          <UFormField name="remark" :label="$ts('module.system.post.remark')" orientation="horizontal" :ui="formItemUi" class="sm:col-span-2">
            <UTextarea v-model="remarkValue" :placeholder="$ts('module.system.post.form.remark')" :rows="3" class="w-full" />
          </UFormField>
        </div>
      </UForm>
    </template>
    <template #footer>
      <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" @click="visible = false" />
      <UButton :label="$ts('common.confirm')" color="primary" type="submit" form="sys-post-form" />
    </template>
  </UModal>
</template>
