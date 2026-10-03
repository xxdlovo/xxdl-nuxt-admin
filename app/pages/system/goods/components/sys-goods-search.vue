<script setup lang="ts">
import { type SysGoodsQueryDTO, SysGoodsQuerySchema } from '#shared/system/goods'
import { goodsStatusConfig, goodsTypeRecord } from '#shared/constants/business'

const { $ts } = useI18n()
const formItemUi = {
  root: 'flex items-center',
  label: 'w-24 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  search: [data: SysGoodsQueryDTO]
}>()

// 搜索条件的 schema 必须指向本模块的 QuerySchema
const schema = SysGoodsQuerySchema
const form = useTemplateRef('form')
const active = ref(undefined)
const state = defineModel<SysGoodsQueryDTO>('model', { required: true })

const typeItems = useTransformRecordToOption(goodsTypeRecord)
// 商品状态是本文常量（不走字典表），候选项与列表徽标同源
const statusItems = computed(() => Object.entries(goodsStatusConfig).map(([value, config]) => ({
  value: Number(value),
  label: $ts(config.i18nKey)
})))

const statusValue = computed<number | undefined>({
  get: () => state.value.status ?? undefined,
  // v-model.nullable 清空时给的是 null，必须回落成 undefined 才能真正移除该查询条件
  set: (value) => {
    const cleared = value === undefined || value === null || String(value) === ''
    state.value.status = cleared ? undefined : Number(value)
  }
})

// 金额区间：空串要还原成 undefined，否则后端会拼出一个非法区间条件
const priceMinValue = computed({
  get: () => state.value.priceMin ?? '',
  set: value => state.value.priceMin = value === '' ? undefined : value
})
const priceMaxValue = computed({
  get: () => state.value.priceMax ?? '',
  set: value => state.value.priceMax = value === '' ? undefined : value
})

// 日期区间在提交时补全为 datetime，后端按字符串比较
const createdFrom = ref<string>('')
const createdTo = ref<string>('')

const items = computed(() => [
  {
    label: $ts('common.search'),
    icon: ''
  }
])

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
            <UFormField name="name" :label="$ts('module.system.goods.name')" orientation="horizontal" :ui="formItemUi">
              <UBaseInput v-model="state.name" :placeholder="$ts('module.system.goods.form.name')" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="type" :label="$ts('module.system.goods.typeLabel')" orientation="horizontal" :ui="formItemUi">
              <USelect v-model.nullable="state.type" :placeholder="$ts('module.system.goods.form.type')" class="w-full" :items="typeItems" clearable />
            </UFormField>
            <UFormField name="status" :label="$ts('module.system.goods.statusLabel')" orientation="horizontal" :ui="formItemUi">
              <USelect v-model.nullable="statusValue" :placeholder="$ts('module.system.goods.form.status')" class="w-full" :items="statusItems" clearable />
            </UFormField>
            <UFormField name="priceMin" :label="$ts('module.system.goods.priceMin')" orientation="horizontal" :ui="formItemUi">
              <UInput v-model="priceMinValue" type="number" :placeholder="$ts('module.system.goods.form.priceMin')" class="w-full" />
            </UFormField>
            <UFormField name="priceMax" :label="$ts('module.system.goods.priceMax')" orientation="horizontal" :ui="formItemUi">
              <UInput v-model="priceMaxValue" type="number" :placeholder="$ts('module.system.goods.form.priceMax')" class="w-full" />
            </UFormField>
            <UFormField name="createdFrom" :label="$ts('module.system.goods.createdFrom')" orientation="horizontal" :ui="formItemUi">
              <UInput v-model="createdFrom" type="date" class="w-full" />
            </UFormField>
            <UFormField name="createdTo" :label="$ts('module.system.goods.createdTo')" orientation="horizontal" :ui="formItemUi">
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
