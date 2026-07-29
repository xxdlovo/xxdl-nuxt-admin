<script setup lang="ts">
import * as z from 'zod'
const { $ts } = useI18n()
import { businessDictCode } from "#shared/constants/business";
// set 0: default open search panel
import { type DemoQueryDTO,DemoQuerySchema } from '#shared/demo';
const formItemUi = {
  root: 'flex items-center',
  label: 'w-16 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}
const emit = defineEmits<{
  search: [data: DemoQueryDTO]
}>()

const schema = DemoQuerySchema
const form = useTemplateRef('form')
const active = ref(undefined)
const state = defineModel<DemoQueryDTO>('model', { required: true });
const statusItems = useDictNumberOptions(businessDictCode.enableStatus)
const items = computed(() => [
  {
    label: $ts('common.search'),
    icon: ''
  }
])

const submit = async () => {
  const isValid = await form.value?.validate({})
  if (isValid) {
    emit('search', state.value)
  }
}
const reset =()=> {
  form.value?.clear()
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
        <UForm ref="form" :validateOn="['input']"  :schema="schema" :state="state" class="p-2">
          <div class=" grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4   gap-x-6 gap-y-6">
            <UFormField name="field1" :label="$ts('module.demo.field1')" orientation="horizontal"   :ui="formItemUi">
              <UBaseInput v-model="state.field1" :placeholder="$ts('module.demo.form.field1')" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="field2" :label="$ts('module.demo.field2')" orientation="horizontal"   :ui="formItemUi">
              <UBaseInput v-model="state.field2" :placeholder="$ts('module.demo.form.field2')" trailing="clear" class="w-full" />
            </UFormField>
           
            <UFormField name="status" :label="$ts('module.demo.demoStatus')" orientation="horizontal" class="w-full" :ui="formItemUi">
              <USelect v-model.nullable="state.status" :placeholder="$ts('module.demo.demoStatus')" class="w-full" :items="statusItems" clearable />
            </UFormField>
            <div class="lg:col-start-4 flex flex-col  pr-8">
              <div class="gap-2  flex justify-end ">
                <UButton icon="tabler:reload" @click="reset"  variant="outline" color="neutral">{{ $ts('common.reset') }}
                </UButton>
                <UButton icon="tabler:search" @click="submit" variant="outline">{{ $ts('common.search') }}</UButton>
              </div>
              <div class="min-h-[20px]">
              </div>
            </div>
          </div>
        </UForm>
      </template>
    </UAccordion>
  </UCard>
</template>


