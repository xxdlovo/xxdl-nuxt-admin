<script setup lang="ts">
import {type SysUserAddDTO, SysUserAddSchema, type SysUserQueryDTO, SysUserQuerySchema} from "#shared/system/user";
import {SysUserBaseSchema, type SysUserDto} from "#shared/system/user/common";
import * as z from 'zod'
import type { FormError, FormSubmitEvent } from '@nuxt/ui'
import {useTransformRecordToOption} from "~/composables/useTransformRecordToOption";
import {enableStatusOptions, enableStatusRecord, userGenderOptions, userGenderRecord} from "#shared/constants/business";
const { $ts } = useI18n()
const props = defineProps<{
  operateType: string;
}>();
const genderValue = computed({
  get: () => String(state.value.gender || 0),
  set: (val) => state.value.gender = Number(val)
});
const statusValue = computed({
  get: () => String(state.value.status || 0),
  set: (val) => state.value.status = Number(val)
});
const state = ref<SysUserAddDTO>({
  id: '',
  username: '',
  password: '',
  nickname: '',
  email: '',
})

const { schema, validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysUserAddSchema : SysUserAddSchema
})
const form = useTemplateRef('form')
const genderItems = useTransformRecordToOption(userGenderRecord)
const statusItems = useTransformRecordToOption(enableStatusRecord)

// 翻译标题
const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.system.user.addUser'),
    edit: $ts('module.system.user.editUser')
  };
  return titles[props.operateType];
});
</script>
<template>
  <UModal :title="title"
          :dismissible="false"
          :ui="{
    content:'max-w-[70%]',
     footer: 'justify-end'
  }">



    <template #body class="w-[50%]">
      <UForm ref="form" :validateOn="['input']" :validate="validate"    :state="state" class="p-2">
        <div class=" grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2   gap-x-6 gap-y-6">
          <UFormField name="username" required :label="$ts('module.system.user.userName')" orientation="horizontal">
            <UInput v-model="state.username" :placeholder="$ts('module.system.user.form.userName')" />
          </UFormField>
          <UFormField name="gender" :label="$ts('module.system.user.userGender')" orientation="horizontal">
            <URadioGroup orientation="horizontal"  v-model="genderValue" :placeholder="$ts('module.system.user.form.userGender')" :items="genderItems"></URadioGroup>
          </UFormField>
          <UFormField name="nickname" :label="$ts('module.system.user.nickName')" orientation="horizontal">
            <UInput v-model="state.nickname" :placeholder="$ts('module.system.user.form.nickName')" />
          </UFormField>
          <UFormField name="phone" :label="$ts('module.system.user.userPhone')" orientation="horizontal">
            <UInput v-model="state.phone" :placeholder="$ts('module.system.user.form.userPhone')" />
          </UFormField>
          <UFormField name="email" required :label="$ts('module.system.user.userEmail')" orientation="horizontal">
            <UInput v-model="state.email" :placeholder="$ts('module.system.user.form.userEmail')" />
          </UFormField>
          <UFormField name="gender" :label="$ts('module.system.user.userStatus')" orientation="horizontal">
            <URadioGroup orientation="horizontal" v-model="statusValue" :placeholder="$ts('module.system.user.form.userStatus')"  :items="statusItems"></URadioGroup>
          </UFormField>
        </div>
      </UForm>

    </template>
    <template #footer="{ close }">
          <UButton label="Cancel" color="neutral" variant="subtle" @click="close"/>
          <UButton label="Confirm" color="primary" />
    </template>
  </UModal>
</template>