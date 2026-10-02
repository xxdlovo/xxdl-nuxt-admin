<script setup lang="ts">
import {
  type SysMemberCouponAddDTO,
  SysMemberCouponAddSchema,
  type SysMemberCouponRespDTO,
  type SysMemberCouponUpdateDTO,
  SysMemberCouponUpdateSchema
} from '#shared/system/memberCoupon'
import type { FormSubmitEvent } from '@nuxt/ui'
import { memberCouponSceneRecord, memberCouponTypeRecord } from '#shared/constants/business'
import { useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const props = defineProps<{
  visible: boolean
  operateType: string
  data?: SysMemberCouponRespDTO
  close?: () => void
  refresh?: () => void
}>()

const formItemUi = {
  root: 'flex items-center',
  label: 'w-32 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const isEdit = computed(() => props.operateType === 'edit')

/** 已作废（status=2）的码：作废不可逆，编辑时不允许把状态改回启用/停用 */
const statusLocked = computed(() => isEdit.value && props.data?.status === 2)

const state = ref<SysMemberCouponAddDTO | SysMemberCouponUpdateDTO>({
  id: '',
  code: '',
  name: '',
  type: 'amount',
  value: '',
  minAmount: '0.00',
  scene: 'all',
  giftAmount: '0.00',
  validFrom: null,
  validTo: null,
  maxUse: 0,
  perUserLimit: 1,
  batchNo: '',
  status: 1,
  remark: ''
})

const { validate } = useZodValidation({
  schema: () => isEdit.value ? SysMemberCouponUpdateSchema : SysMemberCouponAddSchema
})

const typeItems = useTransformRecordToOption(memberCouponTypeRecord)
const sceneItems = useTransformRecordToOption(memberCouponSceneRecord)

// 可空/联合类型字段的统一适配：金额类字段契约允许 string | number，表单统一按字符串收
const valueValue = computed<string>({
  get: () => String(state.value.value ?? ''),
  set: value => state.value.value = value
})
const minAmountValue = computed<string>({
  get: () => String(state.value.minAmount ?? ''),
  set: value => state.value.minAmount = value
})
const giftAmountValue = computed<string>({
  get: () => String(state.value.giftAmount ?? ''),
  set: value => state.value.giftAmount = value
})
const batchNoValue = computed({
  get: () => state.value.batchNo ?? '',
  set: value => state.value.batchNo = value
})
const remarkValue = computed({
  get: () => state.value.remark ?? '',
  set: value => state.value.remark = value
})
const typeValue = computed<string>({
  get: () => state.value.type ?? 'amount',
  set: value => state.value.type = value
})
const sceneValue = computed<string>({
  get: () => state.value.scene ?? 'all',
  set: value => state.value.scene = value
})

/**
 * 有效期只让用户选到「日」：
 * 起始补 00:00:00、截止补 23:59:59，写入契约要求的 YYYY-MM-DD HH:mm:ss。
 */
const validFromDate = ref<string>('')
const validToDate = ref<string>('')

const syncValidRange = () => {
  state.value.validFrom = validFromDate.value ? `${validFromDate.value} 00:00:00` : null
  state.value.validTo = validToDate.value ? `${validToDate.value} 23:59:59` : null
}

watch([validFromDate, validToDate], syncValidRange)

/** 'YYYY-MM-DD HH:mm:ss' → 'YYYY-MM-DD'（type=date 只认日期段） */
const toDatePart = (value?: string | null) => {
  if (!value) return ''
  return value.replace('T', ' ').split(' ')[0] ?? ''
}

const closeDrawer = () => {
  props.close?.()
}

const resetState = () => {
  Object.assign(state.value, {
    id: '',
    code: '',
    name: '',
    type: 'amount',
    value: '',
    minAmount: '0.00',
    scene: 'all',
    giftAmount: '0.00',
    validFrom: null,
    validTo: null,
    maxUse: 0,
    perUserLimit: 1,
    batchNo: '',
    status: 1,
    remark: ''
  })
  validFromDate.value = ''
  validToDate.value = ''
}

const initFormData = () => {
  resetState()

  if (isEdit.value && props.data) {
    Object.assign(state.value, {
      id: props.data.id ?? '',
      code: props.data.code || '',
      name: props.data.name || '',
      type: props.data.type || 'amount',
      value: props.data.value ?? '',
      minAmount: props.data.minAmount ?? '0.00',
      scene: props.data.scene || 'all',
      giftAmount: props.data.giftAmount ?? '0.00',
      validFrom: props.data.validFrom || null,
      validTo: props.data.validTo || null,
      maxUse: props.data.maxUse ?? 0,
      perUserLimit: props.data.perUserLimit ?? 1,
      batchNo: props.data.batchNo || '',
      status: props.data.status ?? 1,
      remark: props.data.remark || ''
    })
    validFromDate.value = toDatePart(props.data.validFrom)
    validToDate.value = toDatePart(props.data.validTo)
  }
}

watch(visible, (opened) => {
  if (opened) {
    initFormData()
  }
})

const handleSubmit = async (_event: FormSubmitEvent<SysMemberCouponAddDTO>) => {
  syncValidRange()

  if (isEdit.value) {
    // code 一经生成不可变更：编辑态提交原值，由服务端忽略
    await $trpc.sysMemberCoupon.update.mutate(state.value as SysMemberCouponUpdateDTO)
    useToastSuccess($ts('common.modifySuccess'))
  } else {
    await $trpc.sysMemberCoupon.create.mutate(state.value as SysMemberCouponAddDTO)
    useToastSuccess($ts('common.addSuccess'))
  }

  closeDrawer()
  props.refresh?.()
}

const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.system.memberCoupon.addSysMemberCoupon'),
    edit: $ts('module.system.memberCoupon.editSysMemberCoupon')
  }

  return titles[props.operateType]
})
</script>

<template>
  <UModal v-model:open="visible" :title="title" :dismissible="false" :ui="{
    content: 'w-[calc(100vw-2rem)] max-w-[860px]',
    footer: 'justify-end gap-2 border-t border-default p-4 sm:px-6'
  }">
    <template #body>
      <UForm ref="form" :validate="validate" :state="state" class="p-2" @submit="handleSubmit">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-6">
          <UFormField
            name="code"
            required
            :label="$ts('module.system.memberCoupon.code')"
            :help="isEdit ? $ts('module.system.memberCoupon.codeLocked') : undefined"
            orientation="horizontal"
            :ui="formItemUi"
          >
            <UBaseInput v-model="state.code" :disabled="isEdit" :placeholder="$ts('module.system.memberCoupon.form.code')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="name" required :label="$ts('module.system.memberCoupon.name')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.name" :placeholder="$ts('module.system.memberCoupon.form.name')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="type" required :label="$ts('module.system.memberCoupon.typeLabel')" orientation="horizontal" :ui="formItemUi">
            <USelect v-model="typeValue" :items="typeItems" :placeholder="$ts('module.system.memberCoupon.form.type')" class="w-full" />
          </UFormField>
          <UFormField
            name="value"
            required
            :label="$ts('module.system.memberCoupon.value')"
            :help="typeValue === 'rate' ? $ts('module.system.memberCoupon.rateHelp') : undefined"
            orientation="horizontal"
            :ui="formItemUi"
          >
            <UInput v-model="valueValue" type="number" step="0.01" :placeholder="$ts('module.system.memberCoupon.form.value')" class="w-full" />
          </UFormField>
          <UFormField name="minAmount" :label="$ts('module.system.memberCoupon.minAmount')" orientation="horizontal" :ui="formItemUi">
            <UInput v-model="minAmountValue" type="number" step="0.01" :placeholder="$ts('module.system.memberCoupon.form.minAmount')" class="w-full" />
          </UFormField>
          <UFormField name="scene" :label="$ts('module.system.memberCoupon.sceneLabel')" orientation="horizontal" :ui="formItemUi">
            <USelect v-model="sceneValue" :items="sceneItems" :placeholder="$ts('module.system.memberCoupon.form.scene')" class="w-full" />
          </UFormField>
          <UFormField name="giftAmount" :label="$ts('module.system.memberCoupon.giftAmount')" orientation="horizontal" :ui="formItemUi">
            <UInput v-model="giftAmountValue" type="number" step="0.01" :placeholder="$ts('module.system.memberCoupon.form.giftAmount')" class="w-full" />
          </UFormField>
          <UFormField name="validFrom" :label="$ts('module.system.memberCoupon.validFrom')" orientation="horizontal" :ui="formItemUi">
            <UInput v-model="validFromDate" type="date" class="w-full" />
          </UFormField>
          <UFormField name="validTo" :label="$ts('module.system.memberCoupon.validTo')" orientation="horizontal" :ui="formItemUi">
            <UInput v-model="validToDate" type="date" class="w-full" />
          </UFormField>
          <UFormField
            name="maxUse"
            :label="$ts('module.system.memberCoupon.maxUse')"
            :help="$ts('module.system.memberCoupon.maxUseHelp')"
            orientation="horizontal"
            :ui="formItemUi"
          >
            <UInputNumber v-model="state.maxUse" :min="0" class="w-full" />
          </UFormField>
          <UFormField name="perUserLimit" :label="$ts('module.system.memberCoupon.perUserLimit')" orientation="horizontal" :ui="formItemUi">
            <UInputNumber v-model="state.perUserLimit" :min="0" class="w-full" />
          </UFormField>
          <UFormField name="batchNo" :label="$ts('module.system.memberCoupon.batchNo')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="batchNoValue" :placeholder="$ts('module.system.memberCoupon.form.batchNo')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField
            name="status"
            :label="$ts('module.system.memberCoupon.statusLabel')"
            :help="statusLocked ? $ts('module.system.memberCoupon.statusLocked') : undefined"
            orientation="horizontal"
            :ui="formItemUi"
          >
            <USwitch v-model="state.status" :true-value="1" :false-value="0" :disabled="statusLocked" />
          </UFormField>
        </div>

        <UFormField name="remark" :label="$ts('module.system.memberCoupon.remark')" orientation="horizontal" :ui="formItemUi" class="mt-5">
          <UTextarea v-model="remarkValue" :rows="2" :placeholder="$ts('module.system.memberCoupon.form.remark')" class="w-full" />
        </UFormField>

        <USeparator class="my-5" />
        <div class="flex justify-end gap-2">
          <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" @click="closeDrawer" />
          <UButton :label="$ts('common.confirm')" color="primary" type="submit" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
