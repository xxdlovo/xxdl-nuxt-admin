<script setup lang="ts">
import {
  type SysOauthAccountAddDTO,
  SysOauthAccountAddSchema,
  type SysOauthAccountUpdateDTO,
  SysOauthAccountUpdateSchema,
  type SysOauthAccountDto
} from '#shared/system/oauthAccount'

import type { FormSubmitEvent } from '@nuxt/ui'
import { useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const props = defineProps<{
  visible: boolean;
  operateType: string;
  data?: SysOauthAccountDto;
  close?: () => void;
  refresh?: () => void;
}>();

const formItemUi = {
  root: 'flex items-center',
  label: 'w-28 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>();

const visible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
});

const state = ref<SysOauthAccountAddDTO | SysOauthAccountUpdateDTO>({
  id: '',
  userId: '',
  provider: 'github',
  providerUserId: '',
  providerLogin: '',
  avatar: '',
  rawProfile: ''
})

const { schema, validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysOauthAccountAddSchema : SysOauthAccountUpdateSchema
})

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
      provider: props.data.provider || '',
      providerUserId: props.data.providerUserId || '',
      providerLogin: props.data.providerLogin || '',
      avatar: props.data.avatar || '',
      rawProfile: props.data.rawProfile || ''
    })
  } else if (props.operateType === 'add') {
    // 新增模式：重置表单
    Object.assign(state.value, {
      id: '',
      userId: '',
      provider: 'github',
      providerUserId: '',
      providerLogin: '',
      avatar: '',
      rawProfile: ''
    })
  }
}

// 每次打开时重新初始化
watch(visible, (newVal) => {
  if (newVal) {
    initFormData()
  }
})

const handleSubmit = async (_event: FormSubmitEvent<SysOauthAccountAddDTO>) => {
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
  await $trpc.sysOauthAccount.update.mutate(state.value as SysOauthAccountUpdateDTO)
  useToastSuccess($ts('common.modifySuccess'))
}

// 保存数据
const handleSave = async () => {
  await $trpc.sysOauthAccount.create.mutate(state.value)
  useToastSuccess($ts('common.addSuccess'))
}

const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.system.oauthAccount.addSysOauthAccount'),
    edit: $ts('module.system.oauthAccount.editSysOauthAccount')
  }
  return titles[props.operateType]
})
</script>

<template>
  <UModal v-model:open="visible" :title="title" :dismissible="false" :ui="{
    content: 'max-w-[30%]',
    footer: 'justify-end'
  }">
    <template #body class="w-[50%]">
      <UForm ref="form" :validate="validate" :state="state" class="p-2" @submit="handleSubmit">
        <div class=" grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2   gap-x-6 gap-y-6">
          <UFormField name="userId" required :label="$ts('module.system.oauthAccount.userId')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.userId" :placeholder="$ts('module.system.oauthAccount.form.userId')" trailing="clear" />
          </UFormField>
          <UFormField name="provider" required :label="$ts('module.system.oauthAccount.provider')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.provider" :placeholder="$ts('module.system.oauthAccount.form.provider')" trailing="clear" />
          </UFormField>
          <UFormField name="providerUserId" required :label="$ts('module.system.oauthAccount.providerUserId')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.providerUserId" :placeholder="$ts('module.system.oauthAccount.form.providerUserId')" trailing="clear" />
          </UFormField>
          <UFormField name="providerLogin" :label="$ts('module.system.oauthAccount.providerLogin')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.providerLogin" :placeholder="$ts('module.system.oauthAccount.form.providerLogin')" trailing="clear" />
          </UFormField>
          <UFormField name="avatar" :label="$ts('module.system.oauthAccount.avatar')" orientation="horizontal"
            :ui="formItemUi">
            <UBaseInput v-model="state.avatar" :placeholder="$ts('module.system.oauthAccount.form.avatar')" trailing="clear" />
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
