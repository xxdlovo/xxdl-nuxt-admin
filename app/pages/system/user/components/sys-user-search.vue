<template>
  <UCard :ui="{ body: ' p-0 sm:p-0 pl-2  sm:pl-2' }" class="w-full cursor-pointer">
    <UAccordion v-model="active" :items="items">
      <template #leading="{ open }">
        <UIcon :name="open ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="cursor-pointer" />
      </template>
      <template #trailing>
        &nbsp;
      </template>
      <template #content>
        <UForm ref="form" :validateOn="['input']"  :schema="schema" :state="state" class="p-2">
          <div class=" grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4   gap-x-6 gap-y-6">
            <UFormField name="username" :label="$ts('module.system.user.userName')" orientation="horizontal"   :ui="formItemUi">
              <UBaseInput v-model="state.username" :placeholder="$ts('module.system.user.form.userName')" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="gender" :label="$ts('module.system.user.userGender')" orientation="horizontal" class="w-full" :ui="formItemUi">
              <USelect v-model.nullable="state.gender" :placeholder="$ts('module.system.user.form.userGender')" class="w-full" :items="translateOptions(userGenderOptions)" clearable />
            </UFormField>
            <UFormField name="nickname" :label="$ts('module.system.user.nickName')" orientation="horizontal" class="w-full" :ui="formItemUi">
              <UBaseInput v-model="state.nickname" :placeholder="$ts('module.system.user.form.nickName')" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="phone" :label="$ts('module.system.user.userPhone')" orientation="horizontal" class="w-full" :ui="formItemUi">
              <UBaseInput v-model="state.phone" :placeholder="$ts('module.system.user.form.userPhone')" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="email" :label="$ts('module.system.user.userEmail')" orientation="horizontal" class="w-full" :ui="formItemUi">
              <UBaseInput v-model="state.email" :placeholder="$ts('module.system.user.form.userEmail')" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="status" :label="$ts('module.system.user.userStatus')" orientation="horizontal" class="w-full" :ui="formItemUi">
              <USelect v-model.nullable="state.status" :placeholder="$ts('module.system.user.form.userStatus')" class="w-full" :items="translateOptions(enableStatusOptions)" clearable />
            </UFormField>
            <div class="lg:col-start-4 flex flex-col  pr-8">
              <div class="gap-2  flex justify-end ">
                <UButton icon="tabler:reload" @click="reset"  variant="outline" color="neutral">{{ $ts('common.reset') }}
                </UButton>
                <UButton icon="tabler:search" @click="submit" variant="outline">{{ $ts('common.search') }}</UButton>
              </div>
              <div class="min-h-[20px]">
              </div>
            </div>
          </div>
        </UForm>
      </template>
    </UAccordion>
  </UCard>
</template>

<script setup lang="ts">
import * as z from 'zod'
const { $ts } = useI18n()
import { userGenderOptions,enableStatusOptions } from "#shared/constants/business";
import type{ Form } from '@nuxt/ui';
import { translateOptions } from "~/utils/common";
// set 0: default open search panel
import {type SysUserQueryDTO, SysUserQuerySchema} from "#shared/system/user";
const formItemUi = {
  root: 'flex items-center',
  label: 'w-16 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}
const emit = defineEmits<{
  search: [data: SysUserQueryDTO]
}>()
const genderItems = [
    {
      label: '未知',
      value: 0
    },
    {
      label: '男',
      value: 1
    },
    {
      label: '女',
      value: 2
    }]
const statusItems = [
    {
      label: '未知',
      value: 0
    },
    {
      label: '正常',
      value: 1
    },
    {
      label: '停用',
      value: 2
    }]
const schema = SysUserQuerySchema
const form = useTemplateRef('form')
// const Schema = z.output<typeof SysUserQuerySchema>
const active = ref(undefined)
const state = defineModel<SysUserQueryDTO>('model', { required: true });
const items = computed(() => [
  {
    label: $ts('common.search'),
    icon: ''
  }
])

const submit = async () => {
  const isValid = await form.value?.validate({})
  if (isValid) {
    emit('search', state.value)
  }
}
const reset =()=> {
  form.value?.clear()
  state.value = {}

}

</script>
