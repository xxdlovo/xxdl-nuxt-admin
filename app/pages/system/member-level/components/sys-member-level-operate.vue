<script setup lang="ts">
import {
  type SysMemberLevelAddDTO,
  SysMemberLevelAddSchema,
  type SysMemberLevelDto,
  type SysMemberLevelUpdateDTO,
  SysMemberLevelUpdateSchema
} from '#shared/system/memberLevel'
import type { FormSubmitEvent } from '@nuxt/ui'
import { useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const props = defineProps<{
  visible: boolean
  operateType: string
  data?: SysMemberLevelDto
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

/** 表单默认值：新等级默认「免费 + 30 天 + 非默认 + 非长期」 */
const defaultLevelValues = {
  id: '',
  code: '',
  name: '',
  sortOrder: 0,
  benefit: '',
  status: 1,
  remark: '',
  price: '0.00',
  durationDays: 30,
  isDefault: 0,
  isLongTerm: 0
}

const state = ref<SysMemberLevelAddDTO | SysMemberLevelUpdateDTO>({ ...defaultLevelValues })

/**
 * 价格归一：price 是 decimal(12,2) 字符串，空值按 0（免费）处理。
 * 输入框里可能是 number（type=number 运行时给数字）或 string，统一先转文本。
 */
const toPriceAmount = (value: unknown) => {
  const raw = String(value ?? '').trim()

  if (!raw) {
    return 0
  }

  const amount = Number(raw)

  return Number.isFinite(amount) ? amount : 0
}

/**
 * 跨字段规则（与后端一致，前端只做前置提示，服务端仍会再校验一次）：
 * - price > 0：不能是长期等级，且 durationDays 必填 ≥ 1；
 * - price = 0：可以是长期等级；若不是长期，durationDays 也要 ≥ 1。
 * 错误文案统一给 i18n key，由 useZodValidation 翻译。
 */
const levelFormSchema = () => {
  const base = props.operateType === 'add' ? SysMemberLevelAddSchema : SysMemberLevelUpdateSchema

  return base.superRefine((value, ctx) => {
    const price = toPriceAmount(value.price)
    const longTerm = Number(value.isLongTerm ?? 0) === 1
    const days = Number(value.durationDays ?? 0)

    if (price > 0 && longTerm) {
      ctx.addIssue({
        code: 'custom',
        path: ['isLongTerm'],
        message: 'module.system.memberLevel.validate.longTermRequiresFree'
      })
    }

    if (!longTerm && (!Number.isInteger(days) || days < 1)) {
      ctx.addIssue({
        code: 'custom',
        path: ['durationDays'],
        message: 'module.system.memberLevel.validate.durationDaysRequired'
      })
    }
  })
}

const { validate } = useZodValidation({
  schema: levelFormSchema
})

// 可空字段的统一适配：避免 null 直接绑到输入组件
const benefitValue = computed({
  get: () => state.value.benefit ?? '',
  set: value => state.value.benefit = value
})
const remarkValue = computed({
  get: () => state.value.remark ?? '',
  set: value => state.value.remark = value
})
const priceValue = computed({
  get: () => state.value.price ?? '',
  set: value => state.value.price = value
})
const durationDaysValue = computed({
  get: () => Number(state.value.durationDays ?? 0),
  set: value => state.value.durationDays = Number(value ?? 0)
})

/** 「长期等级」= 该等级会员永不过期、无需续费 */
const isLongTerm = computed(() => Number(state.value.isLongTerm ?? 0) === 1)
/** 仅「价格 = 0」的免费等级可以设为长期等级（价格 > 0 必须按天续费） */
const canBeLongTerm = computed(() => toPriceAmount(state.value.price) === 0)

const longTermModel = computed({
  get: () => isLongTerm.value,
  set: (value: boolean) => {
    state.value.isLongTerm = value ? 1 : 0

    // 长期等级没有期限：置 0 并与「有效天数」输入保持互斥
    if (value) {
      state.value.durationDays = 0
    } else if (Number(state.value.durationDays ?? 0) < 1) {
      state.value.durationDays = 1
    }
  }
})

const isDefaultModel = computed({
  get: () => Number(state.value.isDefault ?? 0) === 1,
  set: (value: boolean) => state.value.isDefault = value ? 1 : 0
})

// 价格改成 > 0 时自动取消长期（后端同样会拒绝这种组合）
watch(canBeLongTerm, (allowed) => {
  if (!allowed) {
    longTermModel.value = false
  }
})

const closeDrawer = () => {
  props.close?.()
}

const resetState = () => {
  Object.assign(state.value, { ...defaultLevelValues })
}

const initFormData = () => {
  resetState()

  if (props.operateType === 'edit' && props.data) {
    Object.assign(state.value, {
      id: props.data.id ?? '',
      code: props.data.code || '',
      name: props.data.name || '',
      sortOrder: props.data.sortOrder ?? 0,
      benefit: props.data.benefit || '',
      status: props.data.status ?? 1,
      remark: props.data.remark || '',
      // 历史数据里 price 可能是 null，统一回落成 0.00 便于输入框展示
      price: toPriceAmount(props.data.price).toFixed(2),
      durationDays: props.data.durationDays ?? 0,
      isDefault: props.data.isDefault ?? 0,
      isLongTerm: props.data.isLongTerm ?? 0
    })
  }
}

watch(visible, (opened) => {
  if (opened) {
    initFormData()
  }
})

const handleSubmit = async (_event: FormSubmitEvent<SysMemberLevelAddDTO>) => {
  // 提交前归一：价格固定两位小数字符串；长期等级的有效天数固定 0（与后端约定一致）
  state.value.price = toPriceAmount(state.value.price).toFixed(2)

  if (isLongTerm.value) {
    state.value.durationDays = 0
  } else {
    state.value.durationDays = Math.max(1, Math.trunc(Number(state.value.durationDays ?? 0)))
  }

  if (props.operateType === 'add') {
    await $trpc.sysMemberLevel.create.mutate(state.value as SysMemberLevelAddDTO)
    useToastSuccess($ts('common.addSuccess'))
  } else {
    await $trpc.sysMemberLevel.update.mutate(state.value as SysMemberLevelUpdateDTO)
    useToastSuccess($ts('common.modifySuccess'))
  }

  closeDrawer()
  props.refresh?.()
}

const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.system.memberLevel.addSysMemberLevel'),
    edit: $ts('module.system.memberLevel.editSysMemberLevel')
  }

  return titles[props.operateType]
})
</script>

<template>
  <UModal v-model:open="visible" :title="title" :dismissible="false" :ui="{
    content: 'w-[calc(100vw-2rem)] max-w-[760px]',
    footer: 'justify-end gap-2 border-t border-default p-4 sm:px-6'
  }">
    <template #body>
      <UForm ref="form" :validate="validate" :state="state" class="p-2" @submit="handleSubmit">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-6">
          <UFormField name="code" required :label="$ts('module.system.memberLevel.code')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.code" :placeholder="$ts('module.system.memberLevel.form.code')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="name" required :label="$ts('module.system.memberLevel.name')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.name" :placeholder="$ts('module.system.memberLevel.form.name')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="sortOrder" :label="$ts('module.system.memberLevel.sortOrder')" orientation="horizontal" :ui="formItemUi">
            <UInputNumber v-model="state.sortOrder" :min="0" class="w-full" />
          </UFormField>
          <UFormField name="status" :label="$ts('module.system.memberLevel.statusLabel')" orientation="horizontal" :ui="formItemUi">
            <USwitch v-model="state.status" :true-value="1" :false-value="0" />
          </UFormField>
          <UFormField
            name="price"
            :label="$ts('module.system.memberLevel.price')"
            orientation="horizontal"
            :ui="formItemUi"
            :help="$ts('module.system.memberLevel.priceHelp')"
          >
            <UInput
              v-model="priceValue"
              type="number"
              step="0.01"
              min="0"
              :placeholder="$ts('module.system.memberLevel.form.price')"
              class="w-full"
            />
          </UFormField>
          <UFormField
            name="durationDays"
            :label="$ts('module.system.memberLevel.durationDays')"
            orientation="horizontal"
            :ui="formItemUi"
            :help="isLongTerm ? $ts('module.system.memberLevel.isLongTermHelp') : $ts('module.system.memberLevel.durationDaysHelp')"
          >
            <UInputNumber v-model="durationDaysValue" :min="1" :disabled="isLongTerm" class="w-full" />
          </UFormField>
          <UFormField
            name="isDefault"
            :label="$ts('module.system.memberLevel.isDefault')"
            orientation="horizontal"
            :ui="formItemUi"
            :help="$ts('module.system.memberLevel.isDefaultHelp')"
          >
            <USwitch v-model="isDefaultModel" />
          </UFormField>
          <UFormField
            name="isLongTerm"
            :label="$ts('module.system.memberLevel.isLongTerm')"
            orientation="horizontal"
            :ui="formItemUi"
            :help="canBeLongTerm ? $ts('module.system.memberLevel.isLongTermHelp') : $ts('module.system.memberLevel.isLongTermDisabledTip')"
          >
            <!-- 只有免费等级（价格 = 0）才允许设为长期；价格 > 0 时禁用并给出提示 -->
            <USwitch v-model="longTermModel" :disabled="!canBeLongTerm" />
          </UFormField>
        </div>

        <UFormField name="benefit" :label="$ts('module.system.memberLevel.benefit')" orientation="horizontal" :ui="formItemUi" class="mt-5">
          <UTextarea v-model="benefitValue" :rows="3" :placeholder="$ts('module.system.memberLevel.form.benefit')" class="w-full" />
        </UFormField>

        <UFormField name="remark" :label="$ts('module.system.memberLevel.remark')" orientation="horizontal" :ui="formItemUi" class="mt-5">
          <UTextarea v-model="remarkValue" :rows="2" :placeholder="$ts('module.system.memberLevel.form.remark')" class="w-full" />
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
