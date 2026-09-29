<script setup lang="ts">
import { type SysOauthAccountQueryDTO, SysOauthAccountQuerySchema } from '#shared/system/oauthAccount'

const { $ts } = useI18n()
// set 0: default open search panel
const formItemUi = {
  root: 'flex items-center',
  label: 'w-24 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}
const emit = defineEmits<{
  search: [data: SysOauthAccountQueryDTO]
}>()

const schema = SysOauthAccountQuerySchema
const form = useTemplateRef('form')
const active = ref(undefined)
const state = defineModel<SysOauthAccountQueryDTO>('model', { required: true })
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
const reset = () => {
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
        <UForm ref="form" :validateOn="['input']" :schema="schema" :state="state" class="p-2">
          <div class=" grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4   gap-x-6 gap-y-6">
            <UFormField name="provider" :label="$ts('module.system.oauthAccount.provider')" orientation="horizontal" :ui="formItemUi">
              <UBaseInput v-model="state.provider" :placeholder="$ts('module.system.oauthAccount.form.provider')" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="providerLogin" :label="$ts('module.system.oauthAccount.providerLogin')" orientation="horizontal" :ui="formItemUi">
              <UBaseInput v-model="state.providerLogin" :placeholder="$ts('module.system.oauthAccount.form.providerLogin')" trailing="clear" class="w-full" />
            </UFormField>
            <UFormField name="userId" :label="$ts('module.system.oauthAccount.userId')" orientation="horizontal" :ui="formItemUi">
              <UBaseInput v-model="state.userId" :placeholder="$ts('module.system.oauthAccount.form.userId')" trailing="clear" class="w-full" />
            </UFormField>
            <div class="lg:col-start-4 flex flex-col  pr-8">
              <div class="gap-2  flex justify-end ">
                <UButton icon="tabler:reload" @click="reset" variant="outline" color="neutral">{{ $ts('common.reset') }}
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
