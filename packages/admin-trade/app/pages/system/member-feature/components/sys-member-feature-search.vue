<script setup lang="ts">
import type { MemberFeatureKind, MemberFeatureQuery } from './types'
import { memberFeatureQuerySchema } from './types'

const { $ts } = useI18n()
const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  search: [data: MemberFeatureQuery]
}>()

// 搜索条件的 schema 指向本模块的 QuerySchema（featureKey / name / groupName 均模糊匹配）
const schema = memberFeatureQuerySchema
const form = useTemplateRef('form')
const state = defineModel<MemberFeatureQuery>('model', { required: true })

/** 类型候选项与列表徽标同源（switch 开关 / quota 配额） */
const kindItems = computed(() => [
  { value: 'switch', label: $ts('module.system.memberFeature.kindSwitch') },
  { value: 'quota', label: $ts('module.system.memberFeature.kindQuota') }
])

const kindValue = computed<MemberFeatureKind | null | undefined>({
  get: () => state.value.kind ?? undefined,
  // v-model.nullable 清空时给 null，回落成 undefined 才能真正移除该查询条件
  set: (value) => {
    const cleared = value === undefined || value === null || String(value) === ''
    state.value.kind = cleared ? undefined : value as MemberFeatureKind
  }
})

/** 状态：1 启用 / 0 停用（本模块状态是常量，不走字典表） */
const statusItems = computed(() => [
  { value: 1, label: $ts('module.system.memberFeature.statusEnabled') },
  { value: 0, label: $ts('module.system.memberFeature.statusDisabled') }
])

const statusValue = computed<number | null | undefined>({
  get: () => state.value.status ?? undefined,
  set: (value) => {
    const cleared = value === undefined || value === null || String(value) === ''
    state.value.status = cleared ? undefined : Number(value)
  }
})

const submit = () => {
  emit('search', state.value)
}

const beforeSubmit = async () => Boolean(await form.value?.validate({}))

const reset = () => {
  form.value?.clear()
  state.value = {}
}
</script>

<template>
  <FilterPanel
    storage-key="sys-member-feature-search-fab-pos"
    :before-submit="beforeSubmit"
    @search="submit"
    @reset="reset"
  >
    <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="px-2 pb-1">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-6 gap-y-6">
        <UFormField name="featureKey" :label="$ts('module.system.memberFeature.featureKey')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.featureKey" :placeholder="$ts('module.system.memberFeature.search.featureKey')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="name" :label="$ts('module.system.memberFeature.name')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.name" :placeholder="$ts('module.system.memberFeature.search.name')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="groupName" :label="$ts('module.system.memberFeature.groupName')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.groupName" :placeholder="$ts('module.system.memberFeature.search.groupName')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="kind" :label="$ts('module.system.memberFeature.kind')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="kindValue" :placeholder="$ts('module.system.memberFeature.search.kind')" class="w-full" :items="kindItems" clearable />
        </UFormField>
        <UFormField name="status" :label="$ts('module.system.memberFeature.status')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="statusValue" :placeholder="$ts('module.system.memberFeature.search.status')" class="w-full" :items="statusItems" clearable />
        </UFormField>
      </div>
    </UForm>
  </FilterPanel>
</template>
