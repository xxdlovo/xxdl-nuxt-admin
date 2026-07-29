<script setup lang="ts">
import {
  type SysJobAddDTO,
  SysJobAddSchema,
  type SysJobDto,
  type SysJobHandlerDTO,
  type SysJobUpdateDTO,
  SysJobUpdateSchema
} from '#shared/system/job'
import type { FormSubmitEvent } from '@nuxt/ui'
import { businessDictCode } from '#shared/constants/business'
import { useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const props = defineProps<{
  visible: boolean
  operateType: string
  data?: SysJobDto
  handlers: SysJobHandlerDTO[]
  close?: () => void
  refresh?: () => void
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const formItemUi = {
  root: 'flex flex-col gap-1 sm:flex-row sm:items-center',
  label: 'sm:w-28 sm:text-right sm:pr-2 flex-shrink-0',
  container: 'flex-1'
}

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const state = ref<SysJobAddDTO | SysJobUpdateDTO>({
  id: '',
  jobName: '',
  jobCode: '',
  handlerCode: '',
  cronExpression: '0 2 * * *',
  cronTimezone: 'Asia/Shanghai',
  status: 1,
  sortOrder: 0,
  remark: ''
})

const { validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysJobAddSchema : SysJobUpdateSchema
})

const handlerItems = computed(() => props.handlers.map(handler => ({
  label: `${handler.name} (${handler.code})`,
  value: handler.code
})))
const statusItems = useDictNumberOptions(businessDictCode.enableStatus)
const statusValue = computed({
  get: () => Number(state.value.status ?? 1),
  set: val => state.value.status = Number(val)
})
const remarkValue = computed({
  get: () => state.value.remark ?? '',
  set: val => state.value.remark = val || ''
})

function resetState() {
  Object.assign(state.value, {
    id: '',
    jobName: '',
    jobCode: '',
    handlerCode: props.handlers[0]?.code || '',
    cronExpression: '0 2 * * *',
    cronTimezone: 'Asia/Shanghai',
    status: 1,
    sortOrder: 0,
    remark: ''
  })
}

function initFormData() {
  resetState()
  if (props.operateType === 'edit' && props.data) {
    Object.assign(state.value, {
      id: props.data.id,
      jobName: props.data.jobName || '',
      jobCode: props.data.jobCode || '',
      handlerCode: props.data.handlerCode || '',
      cronExpression: props.data.cronExpression || '0 2 * * *',
      cronTimezone: props.data.cronTimezone || 'Asia/Shanghai',
      status: props.data.status ?? 1,
      sortOrder: props.data.sortOrder ?? 0,
      remark: props.data.remark || ''
    })
  }
}

watch(visible, (newVal) => {
  if (newVal) {
    initFormData()
  }
})

const handleSubmit = async (_event: FormSubmitEvent<SysJobAddDTO>) => {
  if (props.operateType === 'add') {
    await $trpc.sysJob.create.mutate(state.value)
    useToastSuccess($ts('common.addSuccess'))
  } else {
    await $trpc.sysJob.update.mutate(state.value as SysJobUpdateDTO)
    useToastSuccess($ts('common.modifySuccess'))
  }
  props.close?.()
  props.refresh?.()
}

const title = computed(() => props.operateType === 'add'
  ? $ts('module.system.job.addJob')
  : $ts('module.system.job.editJob')
)
</script>

<template>
  <UModal v-model:open="visible" :title="title" :dismissible="false" :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[720px]', footer: 'justify-end gap-2 border-t border-default p-4 sm:px-6' }">
    <template #body>
      <UForm id="sys-job-form" :validate="validate" :state="state" class="space-y-5" @submit="handleSubmit">
        <UFormField name="jobName" required :label="$ts('module.system.job.jobName')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.jobName" :placeholder="$ts('module.system.job.form.jobName')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="jobCode" required :label="$ts('module.system.job.jobCode')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.jobCode" :placeholder="$ts('module.system.job.form.jobCode')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="handlerCode" required :label="$ts('module.system.job.handlerCode')" orientation="horizontal" :ui="formItemUi">
          <USelect v-model="state.handlerCode" :items="handlerItems" class="w-full" />
        </UFormField>
        <UFormField name="cronExpression" required :label="$ts('module.system.job.cronExpression')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.cronExpression" placeholder="*/5 * * * *" trailing="clear" class="w-full font-mono" />
        </UFormField>
        <UFormField name="status" :label="$ts('module.system.job.status')" orientation="horizontal" :ui="formItemUi">
          <URadioGroup v-model="statusValue" orientation="horizontal" :items="statusItems" />
        </UFormField>
        <UFormField name="sortOrder" :label="$ts('module.system.job.sortOrder')" orientation="horizontal" :ui="formItemUi">
          <UBaseInput v-model="state.sortOrder" type="number" placeholder="0" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="remark" :label="$ts('module.system.job.remark')" orientation="horizontal" :ui="formItemUi">
          <UTextarea v-model="remarkValue" :placeholder="$ts('module.system.job.form.remark')" :rows="2" class="w-full" />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" @click="props.close?.()" />
      <UButton :label="$ts('common.confirm')" color="primary" type="submit" form="sys-job-form" />
    </template>
  </UModal>
</template>
