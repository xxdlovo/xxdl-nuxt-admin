<script setup lang="ts">
import { type SysMemberRechargeQueryDTO, SysMemberRechargeQuerySchema } from '#trade/shared/system/memberRecharge'
import { memberRechargeStatusConfig } from '#admin/shared/constants/business'

const { $ts } = useI18n()
const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  search: [data: SysMemberRechargeQueryDTO]
}>()

// 搜索条件的 schema 必须指向本模块的 QuerySchema
const schema = SysMemberRechargeQuerySchema
const form = useTemplateRef('form')
const state = defineModel<SysMemberRechargeQueryDTO>('model', { required: true })

const statusItems = useTransformRecordToOption(
  Object.fromEntries(Object.entries(memberRechargeStatusConfig).map(([value, config]) => [value, config.i18nKey]))
)

// 日期区间在提交时补全为 datetime，后端按字符串比较
const createdFrom = ref<string>('')
const createdTo = ref<string>('')

const amountMinValue = computed({
  get: () => state.value.amountMin ?? '',
  set: value => state.value.amountMin = value
})
const amountMaxValue = computed({
  get: () => state.value.amountMax ?? '',
  set: value => state.value.amountMax = value
})

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
    storage-key="sys-member-recharge-search-fab-pos"
    :before-submit="beforeSubmit"
    @search="submit"
    @reset="reset"
  >
    <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="px-2 pb-1">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-6 gap-y-6">
        <UFormField name="outTradeNo" :label="$ts('module.system.memberRecharge.outTradeNo')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.outTradeNo" :placeholder="$ts('module.system.memberRecharge.form.outTradeNo')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="userId" :label="$ts('module.system.memberRecharge.userId')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.userId" :placeholder="$ts('module.system.memberRecharge.form.userId')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="status" :label="$ts('module.system.memberRecharge.statusLabel')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="state.status" :placeholder="$ts('module.system.memberRecharge.form.status')" class="w-full" :items="statusItems" clearable />
        </UFormField>
        <UFormField name="amountMin" :label="$ts('module.system.memberRecharge.amountMin')" orientation="horizontal" :ui="formItemUi">
          <UInput v-model="amountMinValue" type="number" :placeholder="$ts('module.system.memberRecharge.form.amountMin')" class="w-full" />
        </UFormField>
        <UFormField name="amountMax" :label="$ts('module.system.memberRecharge.amountMax')" orientation="horizontal" :ui="formItemUi">
          <UInput v-model="amountMaxValue" type="number" :placeholder="$ts('module.system.memberRecharge.form.amountMax')" class="w-full" />
        </UFormField>
        <UFormField name="createdFrom" :label="$ts('module.system.memberRecharge.createdFrom')" orientation="horizontal" :ui="formItemUi">
          <UInput v-model="createdFrom" type="date" class="w-full" />
        </UFormField>
        <UFormField name="createdTo" :label="$ts('module.system.memberRecharge.createdTo')" orientation="horizontal" :ui="formItemUi">
          <UInput v-model="createdTo" type="date" class="w-full" />
        </UFormField>
      </div>
    </UForm>
  </FilterPanel>
</template>
