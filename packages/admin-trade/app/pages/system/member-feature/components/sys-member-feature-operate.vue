<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { UNLIMITED } from '#admin/shared/entitlement/types'
import { useToastSuccess } from '#admin/app/utils/toast'
import {
  SysMemberFeatureAddSchema,
  SysMemberFeatureUpdateSchema
} from '#trade/shared/system/memberFeature'
import type { MemberFeatureForm, MemberFeatureKind, MemberFeatureRow } from './types'
import { createDefaultMemberFeatureForm } from './types'

const $trpc = useTradeTrpc()
const { $ts } = useI18n()

const props = defineProps<{
  visible: boolean
  operateType: string
  data?: MemberFeatureRow
  close?: () => void
  refresh?: () => void
}>()

const formItemUi = {
  root: 'flex items-center',
  label: 'w-32 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const state = ref<MemberFeatureForm>(createDefaultMemberFeatureForm())

/**
 * 表单校验：字段规则直接用 shared 的 Add / Update Schema（与后端同一份，
 * 包括 `featureKey` 的格式 `^[A-Za-z][A-Za-z0-9_.-]*$` 与最长 64）；
 * 再补两条 Schema 层表达不了的跨字段规则：
 * - kind = quota 必须选计量器；
 * - switch 默认值只能 0/1，quota 默认值只能是 -1（不限）或 >= 0。
 */
const memberFeatureFormSchema = (): z.ZodType<MemberFeatureForm> => {
  const base = props.operateType === 'add' ? SysMemberFeatureAddSchema : SysMemberFeatureUpdateSchema

  // Add / Update 的输出类型不同（Update 多了必填 id），对表单校验而言都按同一个前端模型处理
  return base.superRefine((value, ctx) => {
    const kind = value.kind ?? 'switch'
    const resolverKey = String(value.resolverKey ?? '').trim()
    const defaultValue = Number(value.defaultValue ?? 0)

    if (kind === 'quota' && !resolverKey) {
      ctx.addIssue({
        code: 'custom',
        path: ['resolverKey'],
        message: 'module.system.memberFeature.validate.resolverRequired'
      })
    }

    if (kind === 'switch' && defaultValue !== 0 && defaultValue !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['defaultValue'],
        message: 'module.system.memberFeature.validate.defaultValueInvalid'
      })
    }

    if (kind === 'quota' && defaultValue !== UNLIMITED && defaultValue < 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['defaultValue'],
        message: 'module.system.memberFeature.validate.defaultValueInvalid'
      })
    }
  }) as unknown as z.ZodType<MemberFeatureForm>
}

const { validate } = useZodValidation({
  schema: memberFeatureFormSchema
})

/** 已注册的计量器键（配额型必选；由 host 应用注册，前端只做下拉） */
const resolvers = ref<string[]>([])
const resolversLoading = ref(false)

const loadResolvers = async () => {
  if (resolversLoading.value) {
    return
  }

  resolversLoading.value = true

  try {
    resolvers.value = await $trpc.sysMemberFeature.resolvers.query() ?? []
  } catch {
    // 拿不到就当作「没有可用计量器」，用 emptyResolvers 提示去 host 注册
    resolvers.value = []
  } finally {
    resolversLoading.value = false
  }
}

/**
 * 下拉项：编辑态的历史 resolverKey 可能已从注册表移除，
 * 这里补进选项，避免输入框显示空值让人误以为没配置过。
 */
const resolverItems = computed(() => {
  const list = [...resolvers.value]
  const current = String(state.value.resolverKey ?? '').trim()

  if (current && !list.includes(current)) {
    list.unshift(current)
  }

  return list.map(key => ({ value: key, label: key }))
})

const kindItems = computed(() => [
  { value: 'switch', label: $ts('module.system.memberFeature.kindSwitch') },
  { value: 'quota', label: $ts('module.system.memberFeature.kindQuota') }
])

const isQuota = computed(() => state.value.kind === 'quota')
const isEdit = computed(() => props.operateType === 'edit')

const sortOrderValue = computed({
  get: () => Number(state.value.sortOrder ?? 0),
  set: value => state.value.sortOrder = Number(value ?? 0)
})

/** 开关型默认值：USwitch → 0/1 */
const switchDefaultModel = computed({
  get: () => Number(state.value.defaultValue ?? 0) === 1,
  set: (value: boolean) => state.value.defaultValue = value ? 1 : 0
})

/** 配额默认值：勾了「不限」时输入框显示 0（真正提交的值是 -1） */
const quotaDefaultValue = computed({
  get: () => {
    const value = Number(state.value.defaultValue ?? 0)

    if (value === UNLIMITED) {
      return 0
    }

    return Number.isFinite(value) ? Math.max(0, value) : 0
  },
  set: (value) => {
    state.value.defaultValue = Number(value ?? 0)
  }
})

/** 「不限(-1)」勾选：勾上 = -1，取消勾选回到数字输入（0 起） */
const unlimitedModel = computed({
  get: () => Number(state.value.defaultValue ?? 0) === UNLIMITED,
  set: (value: boolean) => {
    if (value) {
      state.value.defaultValue = UNLIMITED

      return
    }

    if (Number(state.value.defaultValue ?? 0) === UNLIMITED) {
      state.value.defaultValue = 0
    }
  }
})

const adminBypassModel = computed({
  get: () => Number(state.value.adminBypass ?? 1) === 1,
  set: (value: boolean) => state.value.adminBypass = value ? 1 : 0
})

const userShowModel = computed({
  get: () => Number(state.value.userShow ?? 1) === 1,
  set: (value: boolean) => state.value.userShow = value ? 1 : 0
})

const statusModel = computed({
  get: () => Number(state.value.status ?? 1) === 1,
  set: (value: boolean) => state.value.status = value ? 1 : 0
})

/** 开关型没有计量器：切到 switch 时立刻清空，避免把 quota 的配置带过去 */
watch(() => state.value.kind, (kind) => {
  if (kind === 'switch') {
    state.value.resolverKey = ''
  }
})

const closeDrawer = () => {
  props.close?.()
}

const initFormData = () => {
  Object.assign(state.value, createDefaultMemberFeatureForm())

  if (props.operateType !== 'edit' || !props.data) {
    return
  }

  const data = props.data

  Object.assign(state.value, {
    id: data.id ?? '',
    featureKey: data.featureKey || '',
    name: data.name || '',
    kind: (data.kind === 'quota' ? 'quota' : 'switch') as MemberFeatureKind,
    unit: data.unit || '',
    groupName: data.groupName || '',
    sortOrder: data.sortOrder ?? 0,
    defaultValue: Number(data.defaultValue ?? 0),
    resolverKey: data.resolverKey || '',
    adminBypass: data.adminBypass ?? 1,
    userShow: data.userShow ?? 1,
    status: data.status ?? 1
  })
}

watch(visible, (opened) => {
  if (opened) {
    initFormData()
    void loadResolvers()
  }
})

/** 提交前归一：开关型默认值固定 0/1；配额默认值只允许 -1 或 >= 0；开关型清空计量器 */
const normalizeValues = () => {
  if (state.value.kind === 'switch') {
    state.value.resolverKey = ''
    state.value.defaultValue = Number(state.value.defaultValue) === 1 ? 1 : 0

    return
  }

  const value = Math.trunc(Number(state.value.defaultValue ?? 0))

  state.value.defaultValue = value === UNLIMITED ? UNLIMITED : Math.max(0, value)
}

const buildPayload = () => ({
  featureKey: state.value.featureKey.trim(),
  name: state.value.name.trim(),
  kind: state.value.kind,
  unit: state.value.unit.trim() || null,
  groupName: state.value.groupName.trim() || null,
  sortOrder: state.value.sortOrder,
  defaultValue: state.value.defaultValue,
  resolverKey: state.value.kind === 'quota' ? (state.value.resolverKey.trim() || null) : null,
  adminBypass: state.value.adminBypass,
  userShow: state.value.userShow,
  status: state.value.status
})

const handleSubmit = async (_event: FormSubmitEvent<MemberFeatureForm>) => {
  normalizeValues()

  const payload = buildPayload()

  if (props.operateType === 'add') {
    // 新增不接受 id：Add Schema 里没有该字段
    await $trpc.sysMemberFeature.create.mutate(payload)
    useToastSuccess($ts('common.addSuccess'))
  } else {
    // featureKey 一并带上：值未变时服务端忽略，变了会明确拒绝（featureKeyImmutable）
    await $trpc.sysMemberFeature.update.mutate({ ...payload, id: state.value.id })
    useToastSuccess($ts('common.modifySuccess'))
  }

  closeDrawer()
  props.refresh?.()
}

const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.system.memberFeature.addTitle'),
    edit: $ts('module.system.memberFeature.editTitle')
  }

  return titles[props.operateType]
})
</script>

<template>
  <UModal v-model:open="visible" :title="title" :dismissible="false" :ui="{
    content: 'w-[calc(100vw-2rem)] max-w-[820px]',
    footer: 'justify-end gap-2 border-t border-default p-4 sm:px-6'
  }">
    <template #body>
      <UForm :validate="validate" :state="state" class="p-2" @submit="handleSubmit">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-6">
          <UFormField
            name="featureKey"
            required
            :label="$ts('module.system.memberFeature.featureKey')"
            orientation="horizontal"
            :ui="formItemUi"
            :help="isEdit ? $ts('module.system.memberFeature.keyImmutable') : $ts('module.system.memberFeature.keyFormat')"
          >
            <!-- 键是代码契约：编辑时只读，避免把线上功能键改坏 -->
            <UBaseInput
              v-model="state.featureKey"
              :disabled="isEdit"
              :placeholder="$ts('module.system.memberFeature.form.featureKey')"
              class="w-full font-mono"
            />
          </UFormField>
          <UFormField name="name" required :label="$ts('module.system.memberFeature.name')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.name" :placeholder="$ts('module.system.memberFeature.form.name')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="kind" :label="$ts('module.system.memberFeature.kind')" orientation="horizontal" :ui="formItemUi">
            <URadioGroup v-model="state.kind" :items="kindItems" orientation="horizontal" />
          </UFormField>
          <UFormField
            v-if="isQuota"
            name="unit"
            :label="$ts('module.system.memberFeature.unit')"
            orientation="horizontal"
            :ui="formItemUi"
          >
            <UBaseInput v-model="state.unit" :placeholder="$ts('module.system.memberFeature.form.unit')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="groupName" :label="$ts('module.system.memberFeature.groupName')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.groupName" :placeholder="$ts('module.system.memberFeature.form.groupName')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="sortOrder" :label="$ts('module.system.memberFeature.sortOrder')" orientation="horizontal" :ui="formItemUi">
            <UInputNumber v-model="sortOrderValue" :min="0" class="w-full" />
          </UFormField>
          <UFormField
            name="defaultValue"
            :label="$ts('module.system.memberFeature.defaultValue')"
            orientation="horizontal"
            :ui="formItemUi"
          >
            <!-- 开关型：开/关；配额型：数字 + 「不限(-1)」 -->
            <USwitch v-if="!isQuota" v-model="switchDefaultModel" />
            <div v-else class="flex items-center gap-3">
              <UInputNumber v-model="quotaDefaultValue" :min="0" :disabled="unlimitedModel" class="w-32" />
              <UCheckbox v-model="unlimitedModel" :label="$ts('module.system.memberFeature.defaultUnlimited')" />
            </div>
          </UFormField>
          <UFormField
            v-if="isQuota"
            name="resolverKey"
            :label="$ts('module.system.memberFeature.resolverKey')"
            orientation="horizontal"
            :ui="formItemUi"
            :help="resolverItems.length === 0 ? $ts('module.system.memberFeature.emptyResolvers') : undefined"
          >
            <USelect
              v-model="state.resolverKey"
              :items="resolverItems"
              :loading="resolversLoading"
              :placeholder="$ts('module.system.memberFeature.form.resolverKey')"
              class="w-full"
            />
          </UFormField>
          <UFormField
            name="adminBypass"
            :label="$ts('module.system.memberFeature.adminBypass')"
            orientation="horizontal"
            :ui="formItemUi"
            :help="$ts('module.system.memberFeature.adminBypassHelp')"
          >
            <USwitch v-model="adminBypassModel" />
          </UFormField>
          <UFormField
            name="userShow"
            :label="$ts('module.system.memberFeature.userShow')"
            orientation="horizontal"
            :ui="formItemUi"
            :help="$ts('module.system.memberFeature.userShowHelp')"
          >
            <USwitch v-model="userShowModel" />
          </UFormField>
          <UFormField name="status" :label="$ts('module.system.memberFeature.status')" orientation="horizontal" :ui="formItemUi">
            <USwitch v-model="statusModel" />
          </UFormField>
        </div>

        <USeparator class="my-5" />
        <div class="flex justify-end gap-2">
          <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" @click="closeDrawer" />
          <UButton :label="$ts('common.confirm')" color="primary" type="submit" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
