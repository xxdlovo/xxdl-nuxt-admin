<template>
  <FilterPanel
    storage-key="sys-role-menu-search-fab-pos"
    :before-submit="beforeSubmit"
    @search="submit"
    @reset="reset"
  >
    <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="px-2 pb-1">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-6 gap-y-6">
        <UFormField name="roleId" :label="$ts('module.system.roleMenu.roleId')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.roleId" :placeholder="$ts('module.system.roleMenu.form.roleId')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="menuId" :label="$ts('module.system.roleMenu.menuId')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.menuId" :placeholder="$ts('module.system.roleMenu.form.menuId')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="remark" :label="$ts('module.system.roleMenu.remark')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.remark" :placeholder="$ts('module.system.roleMenu.form.remark')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="status" :label="$ts('module.system.roleMenu.roleMenuStatus')" orientation="horizontal" class="w-full" :ui="formItemUi">
          <USelect v-model.nullable="state.status" :placeholder="$ts('module.system.roleMenu.form.roleMenuStatus')" class="w-full" :items="statusItems" clearable />
        </UFormField>
      </div>
    </UForm>
  </FilterPanel>
</template>

<script setup lang="ts">
const { $ts } = useI18n()
import { businessDictCode } from '#admin/shared/constants/business'
import { type SysRoleMenuQueryDTO, SysRoleMenuQuerySchema } from '#admin/shared/system/roleMenu'

const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}
const emit = defineEmits<{
  search: [data: SysRoleMenuQueryDTO]
}>()

const schema = SysRoleMenuQuerySchema
const form = useTemplateRef('form')
const state = defineModel<SysRoleMenuQueryDTO>('model', { required: true })
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
