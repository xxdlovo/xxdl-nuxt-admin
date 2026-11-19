<template>
  <FilterPanel
    storage-key="sys-role-search-fab-pos"
    :before-submit="beforeSubmit"
    @search="submit"
    @reset="reset"
  >
    <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="px-2 pb-1">
      <div class="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        <UFormField name="name" :label="$ts('module.system.role.roleName')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.name" :placeholder="$ts('module.system.role.form.roleName')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="code" :label="$ts('module.system.role.roleCode')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.code" :placeholder="$ts('module.system.role.form.roleCode')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="status" :label="$ts('module.system.role.roleStatus')" orientation="horizontal" class="w-full" :ui="formItemUi">
          <USelect v-model.nullable="state.status" :placeholder="$ts('module.system.role.form.roleStatus')" class="w-full" :items="statusItems" clearable />
        </UFormField>
      </div>
    </UForm>
  </FilterPanel>
</template>

<script setup lang="ts">
const { $ts } = useI18n()
import { businessDictCode } from '#admin/shared/constants/business'
import { type SysRoleQueryDTO, SysRoleQuerySchema } from '#admin/shared/system/role'

const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  search: [data: SysRoleQueryDTO]
}>()

const schema = SysRoleQuerySchema
const form = useTemplateRef('form')
const state = defineModel<SysRoleQueryDTO>('model', { required: true })
const statusItems = useDictNumberOptions(businessDictCode.enableStatus)

const submit = () => {
  emit('search', state.value)
}

const beforeSubmit = async () => Boolean(await form.value?.validate({}))

const reset = () => {
  form.value?.clear()
  state.value = {}
}
</script>
