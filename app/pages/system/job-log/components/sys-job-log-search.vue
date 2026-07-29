<template>
  <UCard :ui="{ body: 'p-0 sm:p-0 pl-2 sm:pl-2' }" class="w-full cursor-pointer">
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
            <UFormField name="jobName" :label="$ts('module.system.jobLog.jobName')" orientation="horizontal" :ui="formItemUi">
              <UBaseInput v-model="state.jobName" :placeholder="$ts('module.system.jobLog.form.jobName')" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="jobCode" :label="$ts('module.system.jobLog.jobCode')" orientation="horizontal" :ui="formItemUi">
              <UBaseInput v-model="state.jobCode" :placeholder="$ts('module.system.jobLog.form.jobCode')" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="status" :label="$ts('module.system.jobLog.logStatus')" orientation="horizontal" :ui="formItemUi">
              <USelect v-model.nullable="state.status" :placeholder="$ts('module.system.jobLog.form.status')" class="w-full" :items="statusItems" clearable />
            </UFormField>
            <div class="lg:col-start-4 flex flex-col pr-8">
              <div class="gap-2 flex justify-end">
                <UButton icon="tabler:reload" variant="outline" color="neutral" @click="reset">{{ $ts('common.reset') }}</UButton>
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
import { businessDictCode } from '#shared/constants/business'
import { type SysJobLogQueryDTO, SysJobLogQuerySchema } from '#shared/system/jobLog'

const { $ts } = useI18n()
const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  search: [data: SysJobLogQueryDTO]
}>()

const schema = SysJobLogQuerySchema
const form = useTemplateRef('form')
const active = ref(undefined)
const state = defineModel<SysJobLogQueryDTO>('model', { required: true })
const statusItems = useDictNumberOptions(businessDictCode.jobLogStatus)
const items = computed(() => [{ label: $ts('common.search'), icon: '' }])

const submit = async () => {
  const isValid = await form.value?.validate({})
  if (isValid) {
    emit('search', state.value)
  }
}

const reset = () => {
  form.value?.clear()
  state.value = {}
}
</script>
