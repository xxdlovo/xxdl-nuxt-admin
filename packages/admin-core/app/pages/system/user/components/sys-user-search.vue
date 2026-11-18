<template>
  <FilterPanel
    storage-key="sys-user-search-fab-pos"
    :before-submit="handleBeforeSubmit"
    @search="handleSearch"
    @reset="handleReset"
  >
    <UForm
      ref="form"
      :validate-on="['input']"
      :schema="SysUserQuerySchema"
      :state="state"
      class="px-2 pb-1"
    >
      <div class="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        <UFormField name="username" :label="$ts('module.system.user.userName')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.username" :placeholder="$ts('module.system.user.form.userName')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="gender" :label="$ts('module.system.user.userGender')" orientation="horizontal" class="w-full" :ui="formItemUi">
          <USelect v-model.nullable="state.gender" :placeholder="$ts('module.system.user.form.userGender')" class="w-full" :items="genderItems" clearable />
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
          <USelect v-model.nullable="state.status" :placeholder="$ts('module.system.user.form.userStatus')" class="w-full" :items="statusItems" clearable />
        </UFormField>
        <UFormField name="remark" :label="$ts('module.system.user.remark')" orientation="horizontal" class="w-full sm:col-span-2" :ui="formItemUi">
          <UBaseInput v-model="state.remark" :placeholder="$ts('module.system.user.form.remark')" trailing="clear" class="w-full" />
        </UFormField>
      </div>
    </UForm>
  </FilterPanel>
</template>

<script setup lang="ts">
import type { SysUserQueryDTO } from '#admin/shared/system/user'
import { SysUserQuerySchema } from '#admin/shared/system/user'
import { businessDictCode } from '#admin/shared/constants/business'

const emit = defineEmits<{
  search: [data: SysUserQueryDTO]
}>()

const { $ts } = useI18n()
const state = defineModel<SysUserQueryDTO>('model', { required: true })
const form = useTemplateRef('form')

const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const genderItems = useDictNumberOptions(businessDictCode.userGender)
const statusItems = useDictNumberOptions(businessDictCode.enableStatus)

/** 提交前校验；不通过时 FilterPanel 不会提交也不会关闭 */
const handleBeforeSubmit = async () => Boolean(await form.value?.validate({}))

const handleSearch = () => {
  emit('search', state.value)
}

const handleReset = () => {
  form.value?.clear()
  state.value = {}
}
</script>
