<script setup lang="ts">
import { type SysOrderQueryDTO, SysOrderQuerySchema } from '#shared/system/order'
import {
  orderFulfillStatusConfig,
  orderPayModeRecord,
  orderStatusConfig
} from '#shared/constants/business'
import MemberUserSelect from '~/components/MemberUserSelect.vue'

const { $ts } = useI18n()
const formItemUi = {
  root: 'flex items-center',
  label: 'w-24 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  search: [data: SysOrderQueryDTO]
}>()

// 搜索条件的 schema 必须指向本模块的 QuerySchema
const schema = SysOrderQuerySchema
const form = useTemplateRef('form')
const active = ref(undefined)
const state = defineModel<SysOrderQueryDTO>('model', { required: true })

const statusItems = useTransformRecordToOption(
  Object.fromEntries(Object.entries(orderStatusConfig).map(([value, config]) => [value, config.i18nKey]))
)
const payModeItems = useTransformRecordToOption(orderPayModeRecord)
const fulfillStatusItems = useTransformRecordToOption(
  Object.fromEntries(Object.entries(orderFulfillStatusConfig).map(([value, config]) => [value, config.i18nKey]))
)

// 日期区间在提交时补全为 datetime，后端按字符串比较
const createdFrom = ref<string>('')
const createdTo = ref<string>('')

const items = computed(() => [
  {
    label: $ts('common.search'),
    icon: ''
  }
])

const amountMinValue = computed({
  get: () => state.value.amountMin ?? '',
  set: value => state.value.amountMin = value
})
const amountMaxValue = computed({
  get: () => state.value.amountMax ?? '',
  set: value => state.value.amountMax = value
})

const submit = async () => {
  const isValid = await form.value?.validate({})

  if (!isValid) {
    return
  }

  state.value.createdFrom = createdFrom.value ? `${createdFrom.value} 00:00:00` : undefined
  state.value.createdTo = createdTo.value ? `${createdTo.value} 23:59:59` : undefined
  emit('search', state.value)
}

const reset = () => {
  form.value?.clear()
  createdFrom.value = ''
  createdTo.value = ''
  state.value = {}
}
</script>

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
        <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="p-2">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-6">
            <UFormField name="orderNo" :label="$ts('module.system.order.orderNo')" orientation="horizontal" :ui="formItemUi">
              <UBaseInput v-model="state.orderNo" :placeholder="$ts('module.system.order.form.orderNo')" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="userId" :label="$ts('module.system.order.member')" orientation="horizontal" :ui="formItemUi">
              <MemberUserSelect v-model="state.userId" source="sysMemberOrder" :placeholder="$ts('module.system.order.form.member')" />
            </UFormField>
            <UFormField name="status" :label="$ts('module.system.order.statusLabel')" orientation="horizontal" :ui="formItemUi">
              <USelect v-model.nullable="state.status" :placeholder="$ts('module.system.order.form.status')" class="w-full" :items="statusItems" clearable />
            </UFormField>
            <UFormField name="payMode" :label="$ts('module.system.order.payModeLabel')" orientation="horizontal" :ui="formItemUi">
              <USelect v-model.nullable="state.payMode" :placeholder="$ts('module.system.order.form.payMode')" class="w-full" :items="payModeItems" clearable />
            </UFormField>
            <UFormField name="fulfillStatus" :label="$ts('module.system.order.fulfillStatusLabel')" orientation="horizontal" :ui="formItemUi">
              <USelect v-model.nullable="state.fulfillStatus" :placeholder="$ts('module.system.order.form.fulfillStatus')" class="w-full" :items="fulfillStatusItems" clearable />
            </UFormField>
            <UFormField name="amountMin" :label="$ts('module.system.order.amountMin')" orientation="horizontal" :ui="formItemUi">
              <UInput v-model="amountMinValue" type="number" :placeholder="$ts('module.system.order.form.amountMin')" class="w-full" />
            </UFormField>
            <UFormField name="amountMax" :label="$ts('module.system.order.amountMax')" orientation="horizontal" :ui="formItemUi">
              <UInput v-model="amountMaxValue" type="number" :placeholder="$ts('module.system.order.form.amountMax')" class="w-full" />
            </UFormField>
            <UFormField name="createdFrom" :label="$ts('module.system.order.createdFrom')" orientation="horizontal" :ui="formItemUi">
              <UInput v-model="createdFrom" type="date" class="w-full" />
            </UFormField>
            <UFormField name="createdTo" :label="$ts('module.system.order.createdTo')" orientation="horizontal" :ui="formItemUi">
              <UInput v-model="createdTo" type="date" class="w-full" />
            </UFormField>
            <div class="lg:col-start-4 flex flex-col pr-8">
              <div class="gap-2 flex justify-end">
                <UButton icon="tabler:reload" @click="reset" variant="outline" color="neutral">{{ $ts('common.reset') }}
                </UButton>
                <UButton icon="tabler:search" @click="submit" variant="outline">{{ $ts('common.search') }}</UButton>
              </div>
              <div class="min-h-[20px]"></div>
            </div>
          </div>
        </UForm>
      </template>
    </UAccordion>
  </UCard>
</template>
