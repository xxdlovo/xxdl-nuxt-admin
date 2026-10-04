<script setup lang="ts">
import type { SysMemberDto } from '#shared/system/member'
import { parseDate, parseTime, today, getLocalTimeZone, type DateValue, type Time } from '@internationalized/date'
import { useToastSuccess } from '~/utils/toast'
import MemberUserSelect from '~/components/MemberUserSelect.vue'

/**
 * 会员建档 / 编辑弹窗。
 *
 * - 建档：给已存在的后台用户开一份会员档案（可选填邀请码绑定上级）
 * - 编辑：等级变更走 `sysMember.update`（服务端会调用领域方法写 levelChangedAt），
 *   其余只允许改状态与备注（userId / inviteCode 建档后不可变）
 * - 会员期限：新增与编辑都可设置到期时间；`expireAt = null` 表示永不过期（长期等级）。
 *   权限仍沿用本页既有的 `system:member:add` / `system:member:edit`（不引入等级权限码）。
 */
const props = defineProps<{
  visible: boolean
  data?: SysMemberDto | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: []
}>()

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const isEdit = computed(() => Boolean(props.data?.id))
const saving = ref(false)

const state = reactive<{
  userId: string
  inviteCode: string
  levelId?: string | null
  levelRemark: string
  status: number
  remark: string
}>({
  userId: '',
  inviteCode: '',
  levelId: null,
  levelRemark: '',
  status: 1,
  remark: ''
})

/** 等级下拉项：额外带上 isLongTerm，用于「长期等级 → 自动勾长期」的联动 */
type MemberLevelOption = {
  label: string
  value: string
  isLongTerm: boolean
}

const levelItems = ref<MemberLevelOption[]>([])

/**
 * 等级下拉返回的字段不在冻结契约里（只有 `sysMember.myLevelOptions` 有契约），
 * 因此这里按结构声明成可选字段：服务端带上 isLongTerm 时联动生效，没带就退化为手工勾选。
 */
type LevelOptionRow = {
  id?: string | null
  name?: string | null
  isLongTerm?: number | null
}

/** 会员下拉需要 string | null，表单态用空串表示「未选择」 */
const userIdModel = computed({
  get: () => state.userId || null,
  set: (value: string | null | undefined) => {
    state.userId = value ?? ''
  }
})

// ── 会员期限 ────────────────────────────────────────────────────────────
/** 沿用「公告」页的日期 + 时间控件组合；日期/时间分开存，提交时拼成 YYYY-MM-DD HH:mm:ss */
const expireDate = shallowRef<DateValue | undefined>(undefined)
const expireTime = shallowRef<Time | undefined>(undefined)
/** 长期 = 永不过期（到期时间传 null） */
const longTerm = ref(false)
/** 由「选中长期等级」自动勾上的长期：等级切回非长期时只回滚自动勾选，不覆盖人工勾选 */
const autoLongTerm = ref(false)

const DEFAULT_EXPIRE_TIME = '23:59:59'
/** 快捷续期按钮：+1 / +7 / +30 天 */
const quickAddDays = [1, 7, 30]

/** 到期时间串：长期或未选日期时为 null */
const expireAt = computed(() => {
  if (longTerm.value || !expireDate.value) {
    return null
  }

  const date = expireDate.value.toString()
  const time = expireTime.value?.toString().slice(0, 8) || DEFAULT_EXPIRE_TIME

  return `${date} ${time}`
})

const longTermModel = computed({
  get: () => longTerm.value,
  set: (value: boolean) => {
    longTerm.value = value

    // 勾选长期后没有到期时间可选，清空并（由模板）禁用输入
    if (value) {
      expireDate.value = undefined
      expireTime.value = undefined
    }
  }
})

/** 快捷续期：基于当前填写值（没填就用今天）叠加天数，点一次就地更新到期时间 */
const addExpireDays = (days: number) => {
  const base = expireDate.value ?? today(getLocalTimeZone())

  expireDate.value = base.add({ days })

  if (!expireTime.value) {
    expireTime.value = parseTime(DEFAULT_EXPIRE_TIME)
  }
}

const setExpireAtValue = (value?: string | null) => {
  if (!value) {
    expireDate.value = undefined
    expireTime.value = undefined
    return
  }

  const [datePart, timePart = DEFAULT_EXPIRE_TIME] = value.replace('T', ' ').split(' ')

  if (!datePart) {
    expireDate.value = undefined
    expireTime.value = undefined
    return
  }

  try {
    expireDate.value = parseDate(datePart)
    expireTime.value = parseTime(timePart.slice(0, 8))
  } catch {
    expireDate.value = undefined
    expireTime.value = undefined
  }
}

/** 选中的等级；选中长期等级时默认勾选「长期」并禁用到期时间输入 */
const selectedLevel = computed(() => levelItems.value.find(item => item.value === state.levelId) ?? null)

watch(() => selectedLevel.value?.isLongTerm, (isLongTerm) => {
  if (isLongTerm) {
    // 已有明确到期时间的历史数据不覆盖，只对「本来就没期限」的档案自动勾选
    if (!expireDate.value) {
      autoLongTerm.value = true
      longTermModel.value = true
    }

    return
  }

  if (autoLongTerm.value) {
    autoLongTerm.value = false
    longTermModel.value = false
  }
})

const loadLevels = async () => {
  if (levelItems.value.length > 0) return

  const levels = await $trpc.sysMember.levelOptions.query() as LevelOptionRow[]

  levelItems.value = levels
    .filter(level => Boolean(level.id))
    .map(level => ({
      label: level.name || (level.id as string),
      value: level.id as string,
      isLongTerm: Number(level.isLongTerm ?? 0) === 1
    }))
}

const fill = () => {
  const item = props.data

  state.userId = item?.userId ?? ''
  state.inviteCode = ''
  state.levelId = item?.levelId ?? null
  state.levelRemark = item?.levelRemark ?? ''
  state.status = item?.status ?? 1
  state.remark = item?.remark ?? ''

  // 建档默认不勾长期（由等级联动决定）；编辑时 expireAt 为空即「永不过期」
  autoLongTerm.value = false
  longTerm.value = isEdit.value ? !item?.expireAt : false
  setExpireAtValue(item?.expireAt ?? null)
}

const save = async () => {
  if (!isEdit.value && !state.userId.trim()) {
    return
  }

  saving.value = true

  try {
    if (isEdit.value && props.data?.id) {
      await $trpc.sysMember.update.mutate({
        id: props.data.id,
        levelId: state.levelId ?? null,
        levelRemark: state.levelRemark || null,
        status: state.status,
        remark: state.remark || null,
        // null = 永不过期（长期等级）；有值时为 YYYY-MM-DD HH:mm:ss
        expireAt: longTerm.value ? null : expireAt.value
      })
    } else {
      await $trpc.sysMember.create.mutate({
        // id 由服务端生成，schema 要求该键存在但允许为 null
        id: null,
        userId: state.userId.trim(),
        inviteCode: state.inviteCode.trim() || null,
        levelId: state.levelId ?? null,
        levelRemark: null,
        inviterId: null,
        inviteCodeId: null,
        status: state.status,
        remark: state.remark || null,
        expireAt: longTerm.value ? null : expireAt.value
      })
    }

    useToastSuccess($ts('module.system.member.saveSuccess'))
    emit('saved')
    visible.value = false
  } finally {
    saving.value = false
  }
}

watch(visible, (opened) => {
  if (opened) {
    fill()
    void loadLevels()
  }
})
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="isEdit ? $ts('module.system.member.editTitle') : $ts('module.system.member.addTitle')"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[560px]', footer: 'justify-end' }"
  >
    <template #body>
      <UForm :state="state" class="space-y-4">
        <UFormField name="userId" required :label="$ts('module.system.member.userId')" :help="isEdit ? '' : $ts('module.system.member.userIdHelp')">
          <!-- 建档：从「还没有会员档案」的用户里搜索选择，避免选到已建档的人 -->
          <UBaseInput v-if="isEdit" v-model="state.userId" disabled class="w-full" />
          <MemberUserSelect
            v-else
            v-model="userIdModel"
            scope="unprofiled"
            :placeholder="$ts('module.system.member.form.userSelect')"
          />
        </UFormField>
        <UFormField v-if="!isEdit" name="inviteCode" :label="$ts('module.system.member.inviteCodeInput')" :help="$ts('module.system.member.inviteCodeInputHelp')">
          <UBaseInput v-model="state.inviteCode" :placeholder="$ts('module.system.member.form.inviteCodeInput')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="levelId" :label="$ts('module.system.member.level')" :help="selectedLevel?.isLongTerm ? $ts('module.system.member.levelLongTermTip') : ''">
          <USelect v-model.nullable="state.levelId" :placeholder="$ts('module.system.member.form.levelId')" class="w-full" :items="levelItems" clearable />
        </UFormField>
        <UFormField name="levelRemark" :label="$ts('module.system.member.levelRemark')">
          <UBaseInput v-model="state.levelRemark" :placeholder="$ts('module.system.member.form.levelRemark')" trailing="clear" class="w-full" />
        </UFormField>

        <USeparator :label="$ts('module.system.member.periodTitle')" />

        <UFormField
          name="expireAt"
          :label="$ts('module.system.member.expireAt')"
          :help="longTerm ? $ts('module.system.member.longTermHelp') : $ts('module.system.member.expireAtMemberHelp')"
        >
          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <UInputDate v-model="expireDate" :disabled="longTerm" class="w-44" />
              <UInputTime v-model="expireTime" :disabled="longTerm" class="w-32" />
              <span v-if="expireAt" class="text-xs text-muted">{{ expireAt }}</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <!-- 快捷续期：以当前填写值为基准叠加天数，点一次就地更新到期时间 -->
              <UButton
                v-for="days in quickAddDays"
                :key="days"
                type="button"
                size="xs"
                variant="outline"
                color="neutral"
                :disabled="longTerm"
                @click="addExpireDays(days)"
              >
                {{ $ts('module.system.member.addDays', { days: String(days) }) }}
              </UButton>
              <UButton
                v-if="expireDate || expireTime"
                type="button"
                size="xs"
                variant="ghost"
                color="neutral"
                :disabled="longTerm"
                icon="i-lucide-x"
                :label="$ts('common.cancel')"
                @click="setExpireAtValue(null)"
              />
            </div>
          </div>
        </UFormField>

        <UFormField name="longTerm" :label="$ts('module.system.member.longTerm')" :help="$ts('module.system.member.longTermHelp')">
          <USwitch v-model="longTermModel" />
        </UFormField>

        <UFormField name="status" :label="$ts('module.system.member.statusLabel')">
          <USwitch v-model="state.status" :true-value="1" :false-value="0" />
        </UFormField>
        <UFormField name="remark" :label="$ts('module.system.member.remark')">
          <UTextarea v-model="state.remark" :rows="3" :placeholder="$ts('module.system.member.form.remark')" class="w-full" />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <UButton color="neutral" variant="subtle" @click="visible = false">
        {{ $ts('common.cancel') }}
      </UButton>
      <UButton color="primary" :loading="saving" :disabled="!isEdit && !state.userId.trim()" @click="save">
        {{ $ts('common.confirm') }}
      </UButton>
    </template>
  </UModal>
</template>
