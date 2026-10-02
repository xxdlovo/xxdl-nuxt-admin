<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { type SysMemberRechargeAddDTO, SysMemberRechargeAddSchema } from '#shared/system/memberRecharge'
import { memberRechargeStatusConfig } from '#shared/constants/business'
import { useToastError, useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const props = defineProps<{
  visible: boolean
  refresh?: () => void | Promise<void>
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const formItemUi = {
  root: 'flex items-center',
  label: 'w-32 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const form = useTemplateRef('form')
const submitting = ref(false)

const statusItems = useTransformRecordToOption(
  Object.fromEntries(Object.entries(memberRechargeStatusConfig).map(([value, config]) => [value, config.i18nKey]))
)

/**
 * 表单态统一用字符串保存输入值（UInput / UTextarea 的 v-model 只接受 string），
 * 提交时再归一成 DTO：金额保持字符串（schema 兼容 string|number），日期补全时分秒。
 */
const state = ref({
  id: null as string | null,
  userId: '',
  amount: '',
  giftAmount: '0.00',
  discountAmount: '0.00',
  payAmount: '',
  outTradeNo: '',
  status: 'WP',
  paidAt: '',
  remark: ''
})

/** 补录成「已到账」时服务端会走领域到账流程自动入账余额，需要给操作者提示 */
const willCredit = computed(() => state.value.status === 'OD')

const { validate } = useZodValidation({
  schema: SysMemberRechargeAddSchema
})

/** date / datetime-local 的输入值 → 服务端要求的 YYYY-MM-DD HH:mm:ss */
const normalizeDateTime = (value?: string | null) => {
  if (!value) {
    return null
  }

  const normalized = value.replace('T', ' ')

  if (normalized.length === 10) {
    return `${normalized} 00:00:00`
  }

  return normalized.length === 16 ? `${normalized}:00` : normalized
}

const isBlankMoney = (value?: string | number | null) => value === undefined || value === null || value === ''

const resetState = () => {
  state.value = {
    id: null,
    userId: '',
    amount: '',
    giftAmount: '0.00',
    discountAmount: '0.00',
    payAmount: '',
    outTradeNo: '',
    status: 'WP',
    paidAt: '',
    remark: ''
  }
}

const closeModal = () => {
  visible.value = false
}

watch(visible, (opened) => {
  if (opened) {
    resetState()
    form.value?.clear()
  }
})

const handleSubmit = async (_event: FormSubmitEvent<SysMemberRechargeAddDTO>) => {
  if (submitting.value) {
    return
  }

  submitting.value = true

  try {
    const payload: SysMemberRechargeAddDTO = {
      ...state.value,
      id: null,
      outTradeNo: state.value.outTradeNo?.trim() || null,
      // 实付留空时由服务端按「充值额 - 优惠抵扣」计算
      payAmount: isBlankMoney(state.value.payAmount) ? null : state.value.payAmount,
      paidAt: normalizeDateTime(state.value.paidAt),
      remark: state.value.remark?.trim() || null
    }

    await $trpc.sysMemberRecharge.create.mutate(payload)
    useToastSuccess($ts('module.system.memberRecharge.addSuccess'))
    closeModal()
    await props.refresh?.()
  } catch (error) {
    // 保留弹窗让操作者修正，并把服务端返回的 message 一起提示
    useToastError($ts('module.system.memberRecharge.addFailed'), undefined, error instanceof Error ? error.message : '')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="$ts('module.system.memberRecharge.addTitle')"
    :dismissible="false"
    :ui="{
      content: 'w-[calc(100vw-2rem)] max-w-[760px]'
    }"
  >
    <template #body>
      <UForm ref="form" :validate="validate" :state="state" class="p-2" @submit="handleSubmit">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-6">
          <UFormField name="userId" required :label="$ts('module.system.memberRecharge.userId')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.userId" :placeholder="$ts('module.system.memberRecharge.form.userId')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="amount" required :label="$ts('module.system.memberRecharge.amount')" orientation="horizontal" :ui="formItemUi">
            <UInput v-model="state.amount" type="number" :placeholder="$ts('module.system.memberRecharge.form.amount')" class="w-full" />
          </UFormField>
          <UFormField name="giftAmount" :label="$ts('module.system.memberRecharge.giftAmount')" orientation="horizontal" :ui="formItemUi">
            <UInput v-model="state.giftAmount" type="number" :placeholder="$ts('module.system.memberRecharge.form.giftAmount')" class="w-full" />
          </UFormField>
          <UFormField name="discountAmount" :label="$ts('module.system.memberRecharge.discountAmount')" orientation="horizontal" :ui="formItemUi">
            <UInput v-model="state.discountAmount" type="number" :placeholder="$ts('module.system.memberRecharge.form.discountAmount')" class="w-full" />
          </UFormField>
          <UFormField name="payAmount" :label="$ts('module.system.memberRecharge.payAmount')" orientation="horizontal" :ui="formItemUi">
            <UInput v-model="state.payAmount" type="number" :placeholder="$ts('module.system.memberRecharge.form.payAmount')" class="w-full" />
          </UFormField>
          <UFormField name="outTradeNo" :label="$ts('module.system.memberRecharge.outTradeNo')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.outTradeNo" :placeholder="$ts('module.system.memberRecharge.form.outTradeNo')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="status" :label="$ts('module.system.memberRecharge.statusLabel')" orientation="horizontal" :ui="formItemUi">
            <USelect v-model.nullable="state.status" :items="statusItems" :placeholder="$ts('module.system.memberRecharge.form.status')" class="w-full" />
          </UFormField>
          <UFormField name="paidAt" :label="$ts('module.system.memberRecharge.paidAt')" orientation="horizontal" :ui="formItemUi">
            <UInput v-model="state.paidAt" type="datetime-local" class="w-full" />
          </UFormField>
        </div>

        <UAlert
          v-if="willCredit"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          :title="$ts('module.system.memberRecharge.creditHint')"
          class="mt-5"
        />

        <UFormField name="remark" :label="$ts('module.system.memberRecharge.remark')" orientation="horizontal" :ui="formItemUi" class="mt-5">
          <UTextarea v-model="state.remark" :rows="2" :placeholder="$ts('module.system.memberRecharge.form.remark')" class="w-full" />
        </UFormField>

        <div class="flex justify-end gap-2 mt-5">
          <UButton type="button" :label="$ts('common.cancel')" color="neutral" variant="subtle" :disabled="submitting" @click="closeModal" />
          <UButton type="submit" :label="$ts('common.confirm')" color="primary" :loading="submitting" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
