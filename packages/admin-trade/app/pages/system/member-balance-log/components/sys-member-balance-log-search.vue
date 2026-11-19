<script setup lang="ts">
import { type SysMemberBalanceLogQueryDTO, SysMemberBalanceLogQuerySchema } from '#trade/shared/system/memberBalanceLog'
import { memberAccountRecord, memberBizTypeRecord, memberDirectionRecord } from '#admin/shared/constants/business'
import MemberUserSelect from '#admin/app/components/MemberUserSelect.vue'

const { $ts } = useI18n()

const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  search: [data: SysMemberBalanceLogQueryDTO]
}>()

const schema = SysMemberBalanceLogQuerySchema
const form = useTemplateRef('form')
const state = defineModel<SysMemberBalanceLogQueryDTO>('model', { required: true })

const accountItems = useTransformRecordToOption(memberAccountRecord)
const directionItems = useTransformRecordToOption(memberDirectionRecord)
const bizTypeItems = useTransformRecordToOption(memberBizTypeRecord)

const createdFrom = ref<string>('')
const createdTo = ref<string>('')

const submit = async () => {
  state.value.createdFrom = createdFrom.value ? `${createdFrom.value} 00:00:00` : undefined
  state.value.createdTo = createdTo.value ? `${createdTo.value} 23:59:59` : undefined
  emit('search', state.value)
}

const beforeSubmit = async () => Boolean(await form.value?.validate({}))

const reset = () => {
  form.value?.clear()
  createdFrom.value = ''
  createdTo.value = ''
  state.value = {}
}
</script>

<template>
  <FilterPanel
    storage-key="sys-member-balance-log-search-fab-pos"
    :before-submit="beforeSubmit"
    @search="submit"
    @reset="reset"
  >
    <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="px-2 pb-1">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-6 gap-y-6">
        <UFormField name="userId" :label="$ts('module.system.memberBalanceLog.userId')" orientation="horizontal" :ui="formItemUi">
          <MemberUserSelect v-model="state.userId" source="sysMemberBalanceLog" :placeholder="$ts('module.system.memberBalanceLog.form.userId')" />
        </UFormField>
        <UFormField name="account" :label="$ts('module.system.memberBalanceLog.account')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="state.account" :placeholder="$ts('module.system.memberBalanceLog.form.account')" class="w-full" :items="accountItems" clearable />
        </UFormField>
        <UFormField name="direction" :label="$ts('module.system.memberBalanceLog.direction')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="state.direction" :placeholder="$ts('module.system.memberBalanceLog.form.direction')" class="w-full" :items="directionItems" clearable />
        </UFormField>
        <UFormField name="bizType" :label="$ts('module.system.memberBalanceLog.bizType')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="state.bizType" :placeholder="$ts('module.system.memberBalanceLog.form.bizType')" class="w-full" :items="bizTypeItems" clearable />
        </UFormField>
        <UFormField name="bizNo" :label="$ts('module.system.memberBalanceLog.bizNo')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.bizNo" :placeholder="$ts('module.system.memberBalanceLog.form.bizNo')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="createdFrom" :label="$ts('module.system.memberBalanceLog.createdFrom')" orientation="horizontal" :ui="formItemUi">
          <UInput v-model="createdFrom" type="date" class="w-full" />
        </UFormField>
        <UFormField name="createdTo" :label="$ts('module.system.memberBalanceLog.createdTo')" orientation="horizontal" :ui="formItemUi">
          <UInput v-model="createdTo" type="date" class="w-full" />
        </UFormField>
      </div>
    </UForm>
  </FilterPanel>
</template>
