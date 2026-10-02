<script setup lang="ts">
import { type SysMemberQueryDTO, SysMemberQuerySchema } from '#shared/system/member'
import { memberStatusConfig } from '#shared/constants/business'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const formItemUi = {
  root: 'flex items-center',
  label: 'w-24 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  search: [data: SysMemberQueryDTO]
}>()

const schema = SysMemberQuerySchema
const form = useTemplateRef('form')
const active = ref(undefined)
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

const items = computed(() => [
  {
    label: $ts('common.search'),
    icon: ''
  }
])

const loadLevels = async () => {
  if (levelItems.value.length > 0) return

  const levels = await $trpc.sysMember.levelOptions.query()
  levelItems.value = levels.map(level => ({
    label: level.name as string,
    value: level.id as string
  }))
}

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

onMounted(() => {
  void loadLevels()
})
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
            <div class="lg:col-start-4 flex flex-col pr-8">
              <div class="gap-2 flex justify-end">
                <UButton icon="tabler:reload" variant="outline" color="neutral" @click="reset">
                  {{ $ts('common.reset') }}
                </UButton>
                <UButton icon="tabler:search" variant="outline" @click="submit">
                  {{ $ts('common.search') }}
                </UButton>
              </div>
              <div class="min-h-[20px]" />
            </div>
          </div>
        </UForm>
      </template>
    </UAccordion>
  </UCard>
</template>
