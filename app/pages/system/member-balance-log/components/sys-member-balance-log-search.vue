<script setup lang="ts">
import { type SysMemberBalanceLogQueryDTO, SysMemberBalanceLogQuerySchema } from '#shared/system/memberBalanceLog'
import { memberAccountRecord, memberBizTypeRecord, memberDirectionRecord } from '#shared/constants/business'
import MemberUserSelect from '~/components/MemberUserSelect.vue'

const { $ts } = useI18n()

const formItemUi = {
  root: 'flex items-center',
  label: 'w-24 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  search: [data: SysMemberBalanceLogQueryDTO]
}>()

const schema = SysMemberBalanceLogQuerySchema
const form = useTemplateRef('form')
const active = ref(undefined)
const state = defineModel<SysMemberBalanceLogQueryDTO>('model', { required: true })

const accountItems = useTransformRecordToOption(memberAccountRecord)
const directionItems = useTransformRecordToOption(memberDirectionRecord)
const bizTypeItems = useTransformRecordToOption(memberBizTypeRecord)

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
            <UFormField name="userId" :label="$ts('module.system.memberBalanceLog.userId')" orientation="horizontal" :ui="formItemUi">
              <MemberUserSelect v-model="state.userId" source="sysMemberBalanceLog" :placeholder="$ts('module.system.memberBalanceLog.form.userId')" />
            </UFormField>
            <UFormField name="account" :label="$ts('module.system.memberBalanceLog.account')" orientation="horizontal" :ui="formItemUi">
              <USelect v-model.nullable="state.account" :placeholder="$ts('module.system.memberBalanceLog.form.account')" class="w-full" :items="accountItems" clearable />
            </UFormField>
            <UFormField name="direction" :label="$ts('module.system.memberBalanceLog.direction')" orientation="horizontal" :ui="formItemUi">
              <USelect v-model.nullable="state.direction" :placeholder="$ts('module.system.memberBalanceLog.form.direction')" class="w-full" :items="directionItems" clearable />
            </UFormField>
            <UFormField name="bizType" :label="$ts('module.system.memberBalanceLog.bizType')" orientation="horizontal" :ui="formItemUi">
              <USelect v-model.nullable="state.bizType" :placeholder="$ts('module.system.memberBalanceLog.form.bizType')" class="w-full" :items="bizTypeItems" clearable />
            </UFormField>
            <UFormField name="bizNo" :label="$ts('module.system.memberBalanceLog.bizNo')" orientation="horizontal" :ui="formItemUi">
              <UBaseInput v-model="state.bizNo" :placeholder="$ts('module.system.memberBalanceLog.form.bizNo')" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="createdFrom" :label="$ts('module.system.memberBalanceLog.createdFrom')" orientation="horizontal" :ui="formItemUi">
              <UInput v-model="createdFrom" type="date" class="w-full" />
            </UFormField>
            <UFormField name="createdTo" :label="$ts('module.system.memberBalanceLog.createdTo')" orientation="horizontal" :ui="formItemUi">
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
