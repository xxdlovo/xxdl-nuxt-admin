<script setup lang="ts">
import {
  type SysMemberLevelAddDTO,
  SysMemberLevelAddSchema,
  type SysMemberLevelDto,
  type SysMemberLevelUpdateDTO,
  SysMemberLevelUpdateSchema
} from '#trade/shared/system/memberLevel'
import type { SysMemberLevelFeatureMatrixItemDTO } from '#trade/shared/system/memberFeature'
import type { FormSubmitEvent } from '@nuxt/ui'
import { customPermissionCode } from '#admin/shared/auth'
import { useToastError, useToastSuccess } from '#admin/app/utils/toast'

const $trpc = useTradeTrpc()
const { $ts } = useI18n()

/**
 * 能力矩阵行：直接用 shared 的 `SysMemberLevelFeatureMatrixItemDTO`
 * （`featureMatrix` 返回项，`value` 已是「等级配置值优先、否则功能目录默认值」的最终值）。
 */
type LevelFeatureItem = SysMemberLevelFeatureMatrixItemDTO

const props = defineProps<{
  visible: boolean
  operateType: string
  data?: SysMemberLevelDto
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

// ── 能力配置（featureMatrix / saveFeatures） ─────────────────────────────
//
// 独立权限 system:memberLevel:feature：有权限才可编辑矩阵，否则只读展示。
// 新增态没有 levelId，无法读写矩阵，因此该区只在编辑态渲染控件，新增态只给一句
// 「保存等级后可配置能力」的提示（见模板 featureNeedSaveFirst）。

/** 保存等级矩阵用的权限码 */
const featurePermissionCode = customPermissionCode('system:memberLevel', 'feature')
const { hasPermission, isAdmin } = useRbacProfile()
const canEditFeatures = computed(() => isAdmin.value || hasPermission(featurePermissionCode))

const featureItems = ref<LevelFeatureItem[]>([])
/** 当前编辑值：featureKey → value */
const featureValues = ref<Record<string, number>>({})
/** 加载时的快照：用于判断「能力区是否有改动」，避免无谓的 saveFeatures */
const featureSnapshot = ref<Record<string, number>>({})
const featureLoading = ref(false)

const isEdit = computed(() => props.operateType === 'edit')

/** 取初始值：矩阵的 `value` 已是最终值（等级配置优先，否则目录默认值） */
const resolveFeatureValue = (item: LevelFeatureItem) => {
  const value = Number(item.value)

  return Number.isFinite(value) ? value : Number(item.defaultValue ?? 0)
}

const loadFeatureMatrix = async () => {
  featureItems.value = []
  featureValues.value = {}
  featureSnapshot.value = {}

  if (!isEdit.value || !props.data?.id) {
    return
  }

  featureLoading.value = true

  try {
    const result = await $trpc.sysMemberLevel.featureMatrix.query({ levelId: String(props.data.id) })
    const items = result.items ?? []
    const values: Record<string, number> = {}

    for (const item of items) {
      values[item.featureKey] = resolveFeatureValue(item)
    }

    featureItems.value = items
    featureValues.value = values
    featureSnapshot.value = { ...values }
  } catch {
    // 矩阵拿不到就按「无可配置项」处理：不阻断等级主体保存（tRPC 客户端已提示错误）
    featureItems.value = []
  } finally {
    featureLoading.value = false
  }
}

/** 按 groupName 分组（空分组归到「通用」），组内按 sortOrder / 名称排序 */
const featureGroups = computed(() => {
  const groups = new Map<string, LevelFeatureItem[]>()

  for (const item of featureItems.value) {
    const name = String(item.groupName ?? '').trim() || $ts('module.system.memberFeature.groupDefault')
    const list = groups.get(name) ?? []

    list.push(item)
    groups.set(name, list)
  }

  return [...groups.entries()].map(([name, items]) => ({
    name,
    items: [...items].sort((a, b) => {
      const diff = Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)

      return diff !== 0 ? diff : String(a.name ?? a.featureKey).localeCompare(String(b.name ?? b.featureKey))
    })
  }))
})

/** 能力区是否有改动（逐项比对快照；新增态矩阵为空，恒为 false） */
const featuresDirty = computed(() => {
  const keys = new Set([...Object.keys(featureSnapshot.value), ...Object.keys(featureValues.value)])

  for (const key of keys) {
    if (Number(featureSnapshot.value[key] ?? 0) !== Number(featureValues.value[key] ?? 0)) {
      return true
    }
  }

  return false
})

const featureIsSwitch = (item: LevelFeatureItem) => item.kind !== 'quota'

const isUnlimitedFeature = (item: LevelFeatureItem) => Number(featureValues.value[item.featureKey] ?? 0) === -1

const quotaNumberValue = (item: LevelFeatureItem) => {
  const value = Number(featureValues.value[item.featureKey] ?? 0)

  return value === -1 ? 0 : Math.max(0, Number.isFinite(value) ? value : 0)
}

const setFeatureValue = (item: LevelFeatureItem, value: number | string | null | undefined) => {
  const next = Math.trunc(Number(value ?? 0))

  featureValues.value = {
    ...featureValues.value,
    [item.featureKey]: Number.isFinite(next) ? next : 0
  }
}

/** 「不限」勾选：勾上 = -1，取消勾选回到数字输入（0 起） */
const toggleUnlimitedFeature = (item: LevelFeatureItem, value: boolean) => {
  setFeatureValue(item, value ? -1 : 0)
}

/** 只读展示：开关 → 开/关；配额 → 不限 / 「N 单位」 */
const featureValueText = (item: LevelFeatureItem) => {
  const value = Number(featureValues.value[item.featureKey] ?? 0)

  if (featureIsSwitch(item)) {
    return value === 1
      ? $ts('module.system.memberFeature.switchOn')
      : $ts('module.system.memberFeature.switchOff')
  }

  if (value === -1) {
    return $ts('module.system.memberFeature.unlimited')
  }

  return item.unit ? `${value} ${item.unit}` : String(value)
}

/** 「默认：X」里的 X：按默认值的类型给可读文案 */
const featureDefaultText = (item: LevelFeatureItem) => {
  const value = Number(item.defaultValue ?? 0)

  if (featureIsSwitch(item)) {
    return value === 1
      ? $ts('module.system.memberFeature.switchOn')
      : $ts('module.system.memberFeature.switchOff')
  }

  if (value === -1) {
    return $ts('module.system.memberFeature.unlimited')
  }

  return item.unit ? `${value} ${item.unit}` : String(value)
}

/** 保存矩阵：只传 featureKey / value（等级主体的字段由 update 单独负责） */
const saveFeatureValues = async (levelId: string) => {
  const values = featureItems.value.map(item => ({
    featureKey: item.featureKey,
    value: Number(featureValues.value[item.featureKey] ?? 0)
  }))

  await $trpc.sysMemberLevel.saveFeatures.mutate({ levelId, values })
}

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
    void loadFeatureMatrix()
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

  const isAdd = props.operateType === 'add'
  const levelId = String(state.value.id || props.data?.id || '')

  // 1) 先存等级主体：失败就停在弹窗里，用户改完可以重试
  try {
    if (isAdd) {
      // create 只返回 boolean；新增态没有 levelId，所以能力矩阵留到「编辑」时再配
      await $trpc.sysMemberLevel.create.mutate(state.value as SysMemberLevelAddDTO)
      useToastSuccess($ts('common.addSuccess'))
    } else {
      await $trpc.sysMemberLevel.update.mutate(state.value as SysMemberLevelUpdateDTO)
      useToastSuccess($ts('common.modifySuccess'))
    }
  } catch {
    // 服务端错误详情已由 tRPC 客户端 toast，这里只补一句「是哪一步失败」
    useToastError($ts('module.system.memberLevel.levelSaveFailed'))

    return
  }

  // 2) 再存能力矩阵：仅编辑态、有 feature 权限、且能力区确实有改动
  if (!isAdd && levelId && canEditFeatures.value && featuresDirty.value) {
    try {
      await saveFeatureValues(levelId)
    } catch {
      // 等级已落库但能力没存上：标题说「能力保存失败」，说明里点明等级其实已保存
      useToastError(
        $ts('module.system.memberLevel.featureSaveFailed'),
        undefined,
        $ts('module.system.memberLevel.featureSavePartial')
      )
      props.refresh?.()

      return
    }
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
    content: 'w-[calc(100vw-2rem)] max-w-[820px]',
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

        <!-- 能力配置：编辑态才读写矩阵（新增态没有 levelId） -->
        <USeparator class="my-5" />

        <div class="space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <UIcon name="i-lucide-toy-brick" class="text-muted" />
            <span class="text-sm font-medium">{{ $ts('module.system.memberLevel.featureSection') }}</span>
            <span v-if="!canEditFeatures && isEdit" class="text-xs text-muted">
              {{ $ts('module.system.memberLevel.featureReadonly') }}
            </span>
          </div>
          <p class="text-xs text-muted">{{ $ts('module.system.memberLevel.featureSectionHelp') }}</p>

          <!-- 新增态：没有 levelId，先提示保存后再回来配置（矩阵区间不渲染） -->
          <p v-if="!isEdit" class="text-xs text-muted">
            {{ $ts('module.system.memberLevel.featureNeedSaveFirst') }}
          </p>

          <div v-else-if="featureLoading" class="py-4 text-center text-xs text-muted">
            {{ $ts('common.loading') }}
          </div>

          <p v-else-if="featureItems.length === 0" class="text-xs text-muted">
            {{ $ts('module.system.memberLevel.featureEmpty') }}
          </p>

          <div v-else class="space-y-4">
            <div v-for="group in featureGroups" :key="group.name" class="space-y-2">
              <div class="text-xs font-medium text-muted">{{ group.name }}</div>

              <div
                v-for="item in group.items"
                :key="item.featureKey"
                class="flex flex-wrap items-center gap-3 rounded-md border border-default px-3 py-2"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="truncate text-sm">{{ item.name || item.featureKey }}</span>
                    <span v-if="item.unit" class="text-xs text-muted">({{ item.unit }})</span>
                    <!-- userShow = 0：用户侧不展示，这里给运营一个「仅后端」的提醒 -->
                    <UTooltip v-if="Number(item.userShow ?? 1) === 0" :text="$ts('module.system.memberFeature.userShowHelp')">
                      <UBadge :label="$ts('module.system.memberFeature.onlyBackend')" color="warning" variant="subtle" size="sm" />
                    </UTooltip>
                    <!-- 功能目录里的默认值：等级没显式配置时就取它，标出来方便运营判断 -->
                    <span class="text-xs text-muted">
                      {{ $ts('module.system.memberLevel.featureDefault', { value: featureDefaultText(item) }) }}
                    </span>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <template v-if="canEditFeatures">
                    <USwitch
                      v-if="featureIsSwitch(item)"
                      :model-value="Number(featureValues[item.featureKey] ?? 0)"
                      :true-value="1"
                      :false-value="0"
                      @update:model-value="value => setFeatureValue(item, Number(value))"
                    />
                    <template v-else>
                      <UInputNumber
                        :model-value="quotaNumberValue(item)"
                        :min="0"
                        :disabled="isUnlimitedFeature(item)"
                        class="w-28"
                        @update:model-value="value => setFeatureValue(item, Number(value ?? 0))"
                      />
                      <UCheckbox
                        :model-value="isUnlimitedFeature(item)"
                        :label="$ts('module.system.memberFeature.unlimited')"
                        @update:model-value="value => toggleUnlimitedFeature(item, Boolean(value))"
                      />
                    </template>
                  </template>
                  <span v-else class="text-sm">{{ featureValueText(item) }}</span>
                </div>
              </div>
            </div>
          </div>
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
