<template>
  <UCard class="w-full" :ui="{ body: 'p-0 sm:p-0 pl-2 sm:pl-2' }">
    <UAccordion v-model="active" :items="items">
      <template #leading="{ open }">
        <UIcon :name="open ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="cursor-pointer" />
      </template>
      <template #trailing>&nbsp;</template>
      <template #content>
        <UForm ref="form" :schema="schema" :state="state" :validate-on="['input']" class="p-2">
          <div class="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            <UFormField name="name" :label="$ts('module.system.post.name')" orientation="horizontal" :ui="formItemUi">
              <UBaseInput v-model="state.name" :placeholder="$ts('module.system.post.form.name')" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="code" :label="$ts('module.system.post.code')" orientation="horizontal" :ui="formItemUi">
              <UBaseInput v-model="state.code" :placeholder="$ts('module.system.post.form.code')" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="status" :label="$ts('module.system.post.status')" orientation="horizontal" :ui="formItemUi">
              <USelect v-model.nullable="state.status" :items="statusItems" :placeholder="$ts('module.system.post.form.status')" clearable class="w-full" />
            </UFormField>
            <div class="flex flex-col pr-8 col-span-full">
              <div class="flex justify-end gap-2">
                <UButton icon="tabler:reload" color="neutral" variant="outline" @click="reset">{{ $ts('common.reset') }}</UButton>
                <UButton icon="tabler:search" variant="outline" @click="submit">{{ $ts('common.search') }}</UButton>
              </div>
            </div>
          </div>
        </UForm>
      </template>
    </UAccordion>
  </UCard>
</template>

<script setup lang="ts">
import { SysPostQuerySchema, type SysPostQueryDTO } from '#admin/shared/system/post'
import { businessDictCode } from '#admin/shared/constants/business'

const { $ts } = useI18n()
const emit = defineEmits<{ search: [data: SysPostQueryDTO] }>()
const form = useTemplateRef('form')
const active = ref(undefined)
const state = defineModel<SysPostQueryDTO>('model', { required: true })
const schema = SysPostQuerySchema
const statusItems = useDictNumberOptions(businessDictCode.enableStatus)
const items = computed(() => [{ label: $ts('common.search'), icon: '' }])
const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 whitespace-nowrap shrink-0 pr-2 text-right',
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
