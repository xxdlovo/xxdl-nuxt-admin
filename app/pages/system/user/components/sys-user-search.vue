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
            <UFormField name="username" label="用户名" orientation="horizontal" class="w-full" :ui="{root:'flex items-center', labelWrapper:'w-24 text-right pr-2 flex-shrink-0', container:'flex-1'}">
              <UBaseInput v-model="state.username" placeholder="请输入用户名" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="gender" label="性别" orientation="horizontal" class="w-full" :ui="{root:'flex items-center', labelWrapper:'w-24 text-right pr-2 flex-shrink-0', container:'flex-1'}">
              <USelect v-model="state.gender" placeholder="请选择性别" class="w-full" :items="genderItems" clearable />
            </UFormField>
            <UFormField name="nickname" label="昵称" orientation="horizontal" class="w-full" :ui="{root:'flex items-center', labelWrapper:'w-24 text-right pr-2 flex-shrink-0', container:'flex-1'}">
              <UBaseInput v-model="state.nickname" placeholder="请输入昵称" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="phone" label="手机号" orientation="horizontal" class="w-full" :ui="{root:'flex items-center', labelWrapper:'w-24 text-right pr-2 flex-shrink-0', container:'flex-1'}">
              <UBaseInput v-model="state.phone" placeholder="请输入手机号" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="email" label="邮箱" orientation="horizontal" class="w-full" :ui="{root:'flex items-center', labelWrapper:'w-24 text-right pr-2 flex-shrink-0', container:'flex-1'}">
              <UBaseInput v-model="state.email" placeholder="请输入邮箱" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="status" label="用户状态" orientation="horizontal" class="w-full" :ui="{root:'flex items-center', labelWrapper:'w-24 text-right pr-2 flex-shrink-0', container:'flex-1'}">
              <USelect v-model="state.status" placeholder="请选择状态" class="w-full" :items="statusItems" clearable />
            </UFormField>
            <div class="lg:col-start-4 flex flex-col  pr-8">
              <div class="gap-2  flex justify-end ">
                <UButton icon="tabler:reload" @click="reset"  variant="outline" color="neutral">重置
                </UButton>
                <UButton icon="tabler:search" @click="submit" variant="outline">搜索</UButton>
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
import type{ Form } from '@nuxt/ui';
// set 0: default open search panel
import {type SysUserQueryDTO, SysUserQuerySchema} from "#shared/system/user";

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
    label: '搜索',
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