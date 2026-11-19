<script setup lang="ts">
import { type SysGoodsQueryDTO, SysGoodsQuerySchema } from '#trade/shared/system/goods'
import { goodsStatusConfig, goodsTypeRecord } from '#admin/shared/constants/business'

const { $ts } = useI18n()
const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  search: [data: SysGoodsQueryDTO]
}>()

// 搜索条件的 schema 必须指向本模块的 QuerySchema
const schema = SysGoodsQuerySchema
const form = useTemplateRef('form')
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
    storage-key="sys-goods-search-fab-pos"
    :before-submit="beforeSubmit"
    @search="submit"
    @reset="reset"
  >
    <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="px-2 pb-1">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-6 gap-y-6">
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
      </div>
    </UForm>
  </FilterPanel>
</template>
