<script setup lang="ts">
import {type SysUserAddDTO, SysUserAddSchema, type SysUserQueryDTO, SysUserQuerySchema} from "#shared/system/user";
import {SysUserBaseSchema, type SysUserDto} from "#shared/system/user/common";
import * as z from 'zod'
import type {FormError, FormSubmitEvent} from '@nuxt/ui'
import {useTransformRecordToOption} from "~/composables/useTransformRecordToOption";
import {enableStatusOptions, enableStatusRecord, userGenderOptions, userGenderRecord} from "#shared/constants/business";
import {useToastSuccess} from "~/utils/toast";
const { $trpc } = useNuxtApp()
const {$ts} = useI18n()
const form = useTemplateRef('form')
const props = defineProps<{
  operateType: string;
  close?: () => void;
  refresh?:() => void;
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

const {schema, validate} = useZodValidation({
  schema: () => props.operateType === 'add' ? SysUserAddSchema : SysUserAddSchema
})
const genderItems = useTransformRecordToOption(userGenderRecord)
const statusItems = useTransformRecordToOption(enableStatusRecord)
const closeDrawer = () => {
  props.close?.()
}
const handleSubmit = async (event: FormSubmitEvent<SysUserAddDTO>) => {
  console.log('提交', state.value)
  if(props.operateType === 'add') {
    await handleSave()
  }
  closeDrawer()
  props.refresh?.()

}
// 保存数据
const handleSave = async()=>{
  await $trpc.sysUser.create.mutate(state.value)
  useToastSuccess('添加成功')
}
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
  <UModal
      :title="title"
      :dismissible="false"
      :ui="{
    content:'max-w-[70%]',
     footer: 'justify-end'
  }">


    <template #body class="w-[50%]">
      <UForm ref="form" :validate="validate" :state="state" class="p-2" @submit="handleSubmit">
        <div class=" grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2   gap-x-6 gap-y-6">
          <UFormField name="username" required :label="$ts('module.system.user.userName')" orientation="horizontal">
            <UInput v-model="state.username" :placeholder="$ts('module.system.user.form.userName')"/>
          </UFormField>
          <UFormField name="password" required :label="$ts('module.system.user.password')" orientation="horizontal">
            <UInput v-model="state.password" :placeholder="$ts('module.system.user.form.password')"/>
          </UFormField>
          <UFormField name="gender" :label="$ts('module.system.user.userGender')" orientation="horizontal">
            <URadioGroup orientation="horizontal" v-model="genderValue"
                         :placeholder="$ts('module.system.user.form.userGender')" :items="genderItems"></URadioGroup>
          </UFormField>
          <UFormField name="nickname" :label="$ts('module.system.user.nickName')" orientation="horizontal">
            <UInput v-model="state.nickname" :placeholder="$ts('module.system.user.form.nickName')"/>
          </UFormField>
          <UFormField name="phone" :label="$ts('module.system.user.userPhone')" orientation="horizontal">
            <UInput v-model="state.phone" :placeholder="$ts('module.system.user.form.userPhone')"/>
          </UFormField>
          <UFormField name="email" required :label="$ts('module.system.user.userEmail')" orientation="horizontal">
            <UInput v-model="state.email" :placeholder="$ts('module.system.user.form.userEmail')"/>
          </UFormField>
          <UFormField name="gender" :label="$ts('module.system.user.userStatus')" orientation="horizontal">
            <URadioGroup orientation="horizontal" v-model="statusValue"
                         :placeholder="$ts('module.system.user.form.userStatus')" :items="statusItems"></URadioGroup>
          </UFormField>
        </div>
        <USeparator class="p-4"/>
        <div class="flex justify-end gap-2">
          <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" @click="closeDrawer"/>
          <UButton :label="$ts('common.confirm')" color="primary" type="submit"/>
        </div>
      </UForm>

    </template>
    <!--    <template #footer="{ close }">-->

    <!--    </template>-->
  </UModal>
</template>