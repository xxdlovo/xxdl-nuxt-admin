<template>
  <UCard class="w-full cursor-pointer" :ui="{ body: 'p-0 sm:p-0 pl-2 sm:pl-2' }">
    <UAccordion v-model="active" :items="items">
      <template #leading="{ open }">
        <UIcon :name="open ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="cursor-pointer" />
      </template>
      <template #trailing>&nbsp;</template>
      <template #content>
        <UForm ref="form" :schema="schema" :state="state" :validate-on="['input']" class="p-2">
          <div class="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            <UFormField name="configName" :label="$ts('module.system.config.configName')" orientation="horizontal" :ui="formItemUi">
              <UBaseInput v-model="state.configName" :placeholder="$ts('module.system.config.form.configName')" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="configKey" :label="$ts('module.system.config.configKey')" orientation="horizontal" :ui="formItemUi">
              <UBaseInput v-model="state.configKey" :placeholder="$ts('module.system.config.form.configKey')" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="configType" :label="$ts('module.system.config.configType')" orientation="horizontal" :ui="formItemUi">
              <USelect v-model.nullable="state.configType" :items="configTypeItems" :placeholder="$ts('module.system.config.form.configType')" clearable class="w-full" />
            </UFormField>
            <UFormField name="status" :label="$ts('module.system.config.status')" orientation="horizontal" :ui="formItemUi">
              <USelect v-model.nullable="state.status" :items="statusItems" :placeholder="$ts('module.system.config.form.status')" clearable class="w-full" />
            </UFormField>
            <div class="flex flex-col pr-8 lg:col-start-4">
              <div class="flex justify-end gap-2">
                <UButton icon="tabler:reload" color="neutral" variant="outline" @click="reset">{{ $ts('common.reset') }}</UButton>
                <UButton icon="tabler:search" variant="outline" @click="submit">{{ $ts('common.search') }}</UButton>
              </div>
              <div class="min-h-[20px]" />
            </div>
          </div>
        </UForm>
      </template>
    </UAccordion>
  </UCard>
</template>

<script setup lang="ts">
import { SysConfigQuerySchema, type SysConfigQueryDTO } from '#shared/system/config'
import { businessDictCode } from '#shared/constants/business'

const { $ts } = useI18n()
const emit = defineEmits<{ search: [data: SysConfigQueryDTO] }>()
const form = useTemplateRef('form')
const active = ref(undefined)
const state = defineModel<SysConfigQueryDTO>('model', { required: true })
const schema = SysConfigQuerySchema
const statusItems = useDictNumberOptions(businessDictCode.enableStatus)
const configTypeItems = computed(() => [
  { label: $ts('module.system.config.type.system'), value: 1 },
  { label: $ts('module.system.config.type.custom'), value: 2 }
])
const items = computed(() => [{ label: $ts('common.search'), icon: '' }])
const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 shrink-0 pr-2 text-right',
  container: 'flex-1'
}

const submit = async () => {
  if (await form.value?.validate({})) emit('search', state.value)
}

const reset = () => {
  form.value?.clear()
  state.value = {}
}
</script>
