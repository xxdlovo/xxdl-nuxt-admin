<script setup lang="ts">
import { type SysMemberQueryDTO, SysMemberQuerySchema } from '#trade/shared/system/member'
import { memberStatusConfig } from '#admin/shared/constants/business'

const $trpc = useTradeTrpc()
const { $ts } = useI18n()

const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  search: [data: SysMemberQueryDTO]
}>()

const schema = SysMemberQuerySchema
const form = useTemplateRef('form')
const state = defineModel<SysMemberQueryDTO>('model', { required: true })

/** 等级下拉：等级是全局字典数据，直接复用会员模块的 levelOptions 接口 */
const levelItems = ref<Array<{ label: string, value: string }>>([])

const statusItems = useTransformRecordToOption(
  Object.fromEntries(Object.entries(memberStatusConfig).map(([value, config]) => [value, config.i18nKey]))
)

const statusValue = computed({
  get: () => (state.value.status === null || state.value.status === undefined ? undefined : String(state.value.status)),
  set: value => state.value.status = value === undefined || value === '' ? undefined : Number(value)
})

// 日期区间在提交时补全为 datetime，后端按字符串比较
const createdFrom = ref<string>('')
const createdTo = ref<string>('')

const loadLevels = async () => {
  if (levelItems.value.length > 0) return

  const levels = await $trpc.sysMember.levelOptions.query()
  levelItems.value = levels.map(level => ({
    label: level.name as string,
    value: level.id as string
  }))
}

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

onMounted(() => {
  void loadLevels()
})
</script>

<template>
  <FilterPanel
    storage-key="sys-member-search-fab-pos"
    :before-submit="beforeSubmit"
    @search="submit"
    @reset="reset"
  >
    <UForm ref="form" :validate-on="['input']" :schema="schema" :state="state" class="px-2 pb-1">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-6 gap-y-6">
        <UFormField name="keyword" :label="$ts('module.system.member.keyword')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.keyword" :placeholder="$ts('module.system.member.form.keyword')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="levelId" :label="$ts('module.system.member.level')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model.nullable="state.levelId" :placeholder="$ts('module.system.member.form.levelId')" class="w-full" :items="levelItems" clearable />
        </UFormField>
        <UFormField name="status" :label="$ts('module.system.member.statusLabel')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model="statusValue" :placeholder="$ts('module.system.member.form.status')" class="w-full" :items="statusItems" clearable />
        </UFormField>
        <UFormField name="userId" :label="$ts('module.system.member.userId')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.userId" :placeholder="$ts('module.system.member.form.userId')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="createdFrom" :label="$ts('module.system.member.createdFrom')" orientation="horizontal" :ui="formItemUi">
          <UInput v-model="createdFrom" type="date" class="w-full" />
        </UFormField>
        <UFormField name="createdTo" :label="$ts('module.system.member.createdTo')" orientation="horizontal" :ui="formItemUi">
          <UInput v-model="createdTo" type="date" class="w-full" />
        </UFormField>
      </div>
    </UForm>
  </FilterPanel>
</template>
