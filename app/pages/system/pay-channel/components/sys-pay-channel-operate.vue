<script setup lang="ts">
import {
  type SysPayChannelAddDTO,
  SysPayChannelAddSchema,
  type SysPayChannelDto,
  type SysPayChannelUpdateDTO,
  SysPayChannelUpdateSchema,
  type SysPayProviderFieldDTO,
  type SysPayProviderMetaDTO
} from '#shared/system/payChannel'
import type { FormSubmitEvent } from '@nuxt/ui'
import { businessDictCode, payChannelCodeRecord } from '#shared/constants/business'
import { useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const props = defineProps<{
  visible: boolean
  operateType: string
  data?: SysPayChannelDto
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

const state = ref<SysPayChannelAddDTO | SysPayChannelUpdateDTO>({
  id: '',
  configKey: '',
  configName: '',
  channelCode: 'xunhupay',
  mode: 'live',
  currency: 'CNY',
  config: {},
  notifyUrl: '',
  returnUrl: '',
  cancelUrl: '',
  orderTimeoutMinutes: 30,
  isDefault: 0,
  status: 1,
  sortOrder: 0,
  ipAllowlist: '',
  remark: ''
})

/** 渠道私有配置：结构由所选渠道类型的 fields 决定，因此这里只做动态键值容器 */
const configModel = ref<Record<string, any>>({})

const providerMetas = ref<SysPayProviderMetaDTO[]>([])
const encryptionReady = ref(true)
/** 'missing' 未配置 / 'invalid' 格式不对，提示文案不同 */
const encryptionReason = ref<'ok' | 'missing' | 'invalid'>('ok')

const { validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysPayChannelAddSchema : SysPayChannelUpdateSchema
})

const statusItems = useDictOptions(businessDictCode.enableStatus)
const noYesItems = useDictOptions(businessDictCode.noYes)

const providerItems = computed(() => providerMetas.value.map(provider => {
  const codeKey = payChannelCodeRecord[provider.code]

  return {
    value: provider.code,
    label: codeKey ? $ts(codeKey) : provider.name
  }
}))

const currentProvider = computed(() => providerMetas.value.find(provider => provider.code === state.value.channelCode) ?? null)
const providerFields = computed<SysPayProviderFieldDTO[]>(() => currentProvider.value?.fields ?? [])

const statusValue = computed({
  get: () => String(state.value.status ?? 1),
  set: value => state.value.status = Number(value)
})
const defaultValue = computed({
  get: () => String(state.value.isDefault ?? 0),
  set: value => state.value.isDefault = Number(value)
})

// 可空字符串字段的统一适配：避免 null 直接绑到输入组件
const currencyValue = computed({
  get: () => state.value.currency ?? '',
  set: value => state.value.currency = value
})
const notifyUrlValue = computed({
  get: () => state.value.notifyUrl ?? '',
  set: value => state.value.notifyUrl = value
})
const returnUrlValue = computed({
  get: () => state.value.returnUrl ?? '',
  set: value => state.value.returnUrl = value
})
const cancelUrlValue = computed({
  get: () => state.value.cancelUrl ?? '',
  set: value => state.value.cancelUrl = value
})
const ipAllowlistValue = computed({
  get: () => state.value.ipAllowlist ?? '',
  set: value => state.value.ipAllowlist = value
})
const remarkValue = computed({
  get: () => state.value.remark ?? '',
  set: value => state.value.remark = value
})

/** 切换渠道类型时清空凭据，避免把上一家的密钥写到新渠道 */
const buildConfigModel = (code?: string | null, source?: Record<string, unknown> | null) => {
  const provider = providerMetas.value.find(item => item.code === code)
  const model: Record<string, any> = {}

  for (const field of provider?.fields ?? []) {
    // 密钥字段编辑态留空：留空 = 保留原值，避免把掩码写回数据库
    if (field.secret) {
      model[field.key] = ''
      continue
    }

    const existing = source?.[field.key]
    model[field.key] = existing ?? field.defaultValue ?? ''
  }

  return model
}

const onChannelChange = (code: string | undefined) => {
  configModel.value = buildConfigModel(code)
}

const loadProviderMetas = async () => {
  if (providerMetas.value.length > 0) {
    return
  }

  const result = await $trpc.sysPayChannel.providerMetas.query()
  providerMetas.value = result.providers
  encryptionReady.value = result.encryptionReady
  encryptionReason.value = result.encryptionReason
}

const closeDrawer = () => {
  props.close?.()
}

const resetState = () => {
  Object.assign(state.value, {
    id: '',
    configKey: '',
    configName: '',
    channelCode: providerMetas.value[0]?.code ?? 'xunhupay',
    mode: 'live',
    currency: 'CNY',
    config: {},
    notifyUrl: '',
    returnUrl: '',
    cancelUrl: '',
    orderTimeoutMinutes: 30,
    isDefault: 0,
    status: 1,
    sortOrder: 0,
    ipAllowlist: '',
    remark: ''
  })
  configModel.value = buildConfigModel(state.value.channelCode)
}

const initFormData = async () => {
  await loadProviderMetas()

  if (props.operateType === 'edit' && props.data) {
    Object.assign(state.value, {
      id: props.data.id ?? '',
      configKey: props.data.configKey || '',
      configName: props.data.configName || '',
      channelCode: props.data.channelCode || 'xunhupay',
      mode: props.data.mode || 'live',
      currency: props.data.currency || 'CNY',
      config: props.data.config ?? {},
      notifyUrl: props.data.notifyUrl || '',
      returnUrl: props.data.returnUrl || '',
      cancelUrl: props.data.cancelUrl || '',
      orderTimeoutMinutes: props.data.orderTimeoutMinutes ?? 30,
      isDefault: props.data.isDefault ?? 0,
      status: props.data.status ?? 1,
      sortOrder: props.data.sortOrder ?? 0,
      ipAllowlist: props.data.ipAllowlist || '',
      remark: props.data.remark || ''
    })
    configModel.value = buildConfigModel(props.data.channelCode, props.data.config as Record<string, unknown> | undefined)
    return
  }

  resetState()
}

watch(visible, (opened) => {
  if (opened) {
    void initFormData()
  }
})

const handleSubmit = async (_event: FormSubmitEvent<SysPayChannelAddDTO>) => {
  const payload = {
    ...state.value,
    config: { ...configModel.value }
  }

  if (props.operateType === 'add') {
    await $trpc.sysPayChannel.create.mutate(payload as SysPayChannelAddDTO)
    useToastSuccess($ts('common.addSuccess'))
  } else {
    await $trpc.sysPayChannel.update.mutate(payload as SysPayChannelUpdateDTO)
    useToastSuccess($ts('common.modifySuccess'))
  }

  closeDrawer()
  props.refresh?.()
}

const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.system.payChannel.addSysPayChannel'),
    edit: $ts('module.system.payChannel.editSysPayChannel')
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
          <UFormField name="configName" required :label="$ts('module.system.payChannel.configName')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.configName" :placeholder="$ts('module.system.payChannel.form.configName')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="configKey" required :label="$ts('module.system.payChannel.configKey')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.configKey" :placeholder="$ts('module.system.payChannel.form.configKey')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="channelCode" required :label="$ts('module.system.payChannel.channelCode')" orientation="horizontal" :ui="formItemUi">
            <USelect v-model="state.channelCode" :items="providerItems" :placeholder="$ts('module.system.payChannel.form.channelCode')" class="w-full" @update:model-value="onChannelChange" />
          </UFormField>
          <UFormField name="mode" :label="$ts('module.system.payChannel.modeLabel')" orientation="horizontal" :ui="formItemUi">
            <USelect v-model="state.mode" :items="[{ value: 'live', label: $ts('module.system.payChannel.mode.live') }, { value: 'test', label: $ts('module.system.payChannel.mode.test') }]" class="w-full" />
          </UFormField>
          <UFormField name="currency" :label="$ts('module.system.payChannel.currency')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="currencyValue" :placeholder="$ts('module.system.payChannel.form.currency')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="orderTimeoutMinutes" :label="$ts('module.system.payChannel.orderTimeoutMinutes')" orientation="horizontal" :ui="formItemUi">
            <UInputNumber v-model="state.orderTimeoutMinutes" :min="1" :max="1440" class="w-full" />
          </UFormField>
          <UFormField name="isDefault" :label="$ts('module.system.payChannel.isDefault')" orientation="horizontal" :ui="formItemUi">
            <USelect v-model="defaultValue" :items="noYesItems" class="w-full" />
          </UFormField>
          <UFormField name="status" :label="$ts('module.system.payChannel.status')" orientation="horizontal" :ui="formItemUi">
            <USelect v-model="statusValue" :items="statusItems" class="w-full" />
          </UFormField>
          <UFormField name="sortOrder" :label="$ts('module.system.payChannel.sortOrder')" orientation="horizontal" :ui="formItemUi">
            <UInputNumber v-model="state.sortOrder" :min="0" class="w-full" />
          </UFormField>
          <UFormField name="notifyUrl" :label="$ts('module.system.payChannel.notifyUrl')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="notifyUrlValue" :placeholder="$ts('module.system.payChannel.form.notifyUrl')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="returnUrl" :label="$ts('module.system.payChannel.returnUrl')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="returnUrlValue" :placeholder="$ts('module.system.payChannel.form.returnUrl')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="cancelUrl" :label="$ts('module.system.payChannel.cancelUrl')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="cancelUrlValue" :placeholder="$ts('module.system.payChannel.form.cancelUrl')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="ipAllowlist" :label="$ts('module.system.payChannel.ipAllowlist')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="ipAllowlistValue" :placeholder="$ts('module.system.payChannel.form.ipAllowlist')" trailing="clear" class="w-full" />
          </UFormField>
        </div>

        <template v-if="providerFields.length > 0">
          <USeparator class="my-5" :label="$ts('module.system.payChannel.providerConfig')" />

          <UAlert
            v-if="!encryptionReady"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="encryptionReason === 'invalid'
              ? $ts('module.system.payChannel.encryptionInvalid')
              : $ts('module.system.payChannel.encryptionMissing')"
            class="mb-4"
          />

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-6">
            <UFormField
              v-for="field in providerFields"
              :key="field.key"
              :name="`config.${field.key}`"
              :required="field.required"
              :label="$ts(field.label)"
              :help="field.help ? $ts(field.help) : undefined"
              orientation="horizontal"
              :ui="formItemUi"
            >
              <UBaseInput
                v-if="field.type === 'text'"
                v-model="configModel[field.key]"
                :placeholder="field.placeholder ? $ts(field.placeholder) : undefined"
                trailing="clear"
                class="w-full"
              />
              <UBaseInput
                v-else-if="field.type === 'password'"
                v-model="configModel[field.key]"
                type="password"
                trailing="password"
                :placeholder="field.secret && configModel[field.key] === '' ? $ts('module.system.payChannel.secretKeepHint') : (field.placeholder ? $ts(field.placeholder) : undefined)"
                class="w-full"
              />
              <UTextarea
                v-else-if="field.type === 'textarea'"
                v-model="configModel[field.key]"
                :rows="2"
                :placeholder="field.placeholder ? $ts(field.placeholder) : undefined"
                class="w-full"
              />
              <USwitch
                v-else-if="field.type === 'switch'"
                v-model="configModel[field.key]"
              />
              <UInputNumber
                v-else
                :model-value="Number(configModel[field.key] ?? 0)"
                class="w-full"
                @update:model-value="value => configModel[field.key] = value ?? 0"
              />
            </UFormField>
          </div>
        </template>

        <UFormField name="remark" :label="$ts('module.system.payChannel.remark')" orientation="horizontal" :ui="formItemUi" class="mt-5">
          <UTextarea v-model="remarkValue" :rows="2" :placeholder="$ts('module.system.payChannel.form.remark')" class="w-full" />
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
