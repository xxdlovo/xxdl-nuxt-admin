<script setup lang="ts">
import type { SysMemberDto } from '#shared/system/member'
import { useToastSuccess } from '~/utils/toast'
import MemberUserSelect from '~/components/MemberUserSelect.vue'

/**
 * 会员建档 / 编辑弹窗。
 *
 * - 建档：给已存在的后台用户开一份会员档案（可选填邀请码绑定上级）
 * - 编辑：等级变更走 `sysMember.update`（服务端会调用领域方法写 levelChangedAt），
 *   其余只允许改状态与备注（userId / inviteCode 建档后不可变）
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

const levelItems = ref<Array<{ label: string, value: string }>>([])

/** 会员下拉需要 string | null，表单态用空串表示「未选择」 */
const userIdModel = computed({
  get: () => state.userId || null,
  set: (value: string | null | undefined) => {
    state.userId = value ?? ''
  }
})

const loadLevels = async () => {
  if (levelItems.value.length > 0) return

  const levels = await $trpc.sysMember.levelOptions.query()
  levelItems.value = levels.map(level => ({ label: level.name as string, value: level.id as string }))
}

const fill = () => {
  const item = props.data

  state.userId = item?.userId ?? ''
  state.inviteCode = ''
  state.levelId = item?.levelId ?? null
  state.levelRemark = item?.levelRemark ?? ''
  state.status = item?.status ?? 1
  state.remark = item?.remark ?? ''}

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
        remark: state.remark || null
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
        remark: state.remark || null
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
        <UFormField name="levelId" :label="$ts('module.system.member.level')">
          <USelect v-model.nullable="state.levelId" :placeholder="$ts('module.system.member.form.levelId')" class="w-full" :items="levelItems" clearable />
        </UFormField>
        <UFormField name="levelRemark" :label="$ts('module.system.member.levelRemark')">
          <UBaseInput v-model="state.levelRemark" :placeholder="$ts('module.system.member.form.levelRemark')" trailing="clear" class="w-full" />
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
