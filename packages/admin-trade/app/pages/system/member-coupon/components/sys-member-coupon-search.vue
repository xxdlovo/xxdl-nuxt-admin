<script setup lang="ts">
import { type SysMemberCouponQueryDTO, SysMemberCouponQuerySchema } from '#trade/shared/system/memberCoupon'
import { memberCouponSceneRecord } from '#admin/shared/constants/business'

const { $ts } = useI18n()
const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  search: [data: SysMemberCouponQueryDTO]
}>()

// 搜索条件的 schema 必须指向本模块的 QuerySchema
const schema = SysMemberCouponQuerySchema
const form = useTemplateRef('form')
const state = defineModel<SysMemberCouponQueryDTO>('model', { required: true })

const sceneItems = useTransformRecordToOption(memberCouponSceneRecord)

/** 状态候选项与列表徽标同源（本模块状态是常量，不走字典表） */
const statusItems = computed(() => [
  { value: 1, label: $ts('module.system.memberCoupon.status.enabled') },
  { value: 0, label: $ts('module.system.memberCoupon.status.disabled') },
  { value: 2, label: $ts('module.system.memberCoupon.status.void') }
])

const statusValue = computed<number | null | undefined>({
  get: () => state.value.status ?? undefined,
  // v-model.nullable 清空时给的是 null，必须回落成 undefined 才能真正移除该查询条件
  set: (value) => {
    const cleared = value === undefined || value === null || String(value) === ''
    state.value.status = cleared ? undefined : Number(value)
  }
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
    storage-key="sys-member-coupon-search-fab-pos"
    :before-submit="beforeSubmit"
    @search="submit"
    @reset="reset"
  >
    <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="px-2 pb-1">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-6 gap-y-6">
        <UFormField name="code" :label="$ts('module.system.memberCoupon.code')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.code" :placeholder="$ts('module.system.memberCoupon.form.code')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="name" :label="$ts('module.system.memberCoupon.name')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.name" :placeholder="$ts('module.system.memberCoupon.form.name')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="scene" :label="$ts('module.system.memberCoupon.sceneLabel')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="state.scene" :placeholder="$ts('module.system.memberCoupon.form.scene')" class="w-full" :items="sceneItems" clearable />
        </UFormField>
        <UFormField name="status" :label="$ts('module.system.memberCoupon.statusLabel')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="statusValue" :placeholder="$ts('module.system.memberCoupon.form.status')" class="w-full" :items="statusItems" clearable />
        </UFormField>
        <UFormField name="createdFrom" :label="$ts('module.system.memberCoupon.createdFrom')" orientation="horizontal" :ui="formItemUi">
          <UInput v-model="createdFrom" type="date" class="w-full" />
        </UFormField>
        <UFormField name="createdTo" :label="$ts('module.system.memberCoupon.createdTo')" orientation="horizontal" :ui="formItemUi">
          <UInput v-model="createdTo" type="date" class="w-full" />
        </UFormField>
      </div>
    </UForm>
  </FilterPanel>
</template>
