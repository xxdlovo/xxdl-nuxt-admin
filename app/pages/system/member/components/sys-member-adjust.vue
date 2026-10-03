<script setup lang="ts">
import { randomUuid } from '#shared/utils/uuid'
import { memberAccountRecord, memberDirectionRecord } from '#shared/constants/business'
import { useToastSuccess } from '~/utils/toast'

/**
 * 手工调账弹窗：加 / 减余额。
 *
 * 幂等：每次打开弹窗生成一个 `requestId`，服务端用它作为流水的幂等键，
 * 连点或网络重试都只会生效一次。
 */
const props = defineProps<{
  visible: boolean
  data?: { id?: string | null, userId?: string | null, nickname?: string | null } | null
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

const saving = ref(false)
const requestId = ref('')

const state = reactive<{
  account: 'recharge' | 'gift'
  direction: 'in' | 'out'
  /**
   * 声明为 string 以满足 `UInput` 的绑定类型；但 `type="number"` 在运行时可能给出
   * number，因此判空与提交一律经 `toText()`，不要直接调 `.trim()`。
   */
  amount: string
  reason: string
  remark: string
}>({
  account: 'recharge',
  direction: 'in',
  amount: '',
  reason: '',
  remark: ''
})

const accountItems = useTransformRecordToOption(memberAccountRecord)
const directionItems = useTransformRecordToOption(memberDirectionRecord)

/**
 * 统一转成字符串再判空：数字型输入没有 `.trim()`，
 * 直接在 computed 里调用会抛 TypeError，导致按钮永远禁用（历史 bug）。
 */
const toText = (value: string | number | null | undefined) => String(value ?? '').trim()

const canSubmit = computed(() => Boolean(toText(state.amount)) && Boolean(toText(state.reason)))

const save = async () => {
  if (!props.data?.userId || !canSubmit.value) {
    return
  }

  saving.value = true

  try {
    await $trpc.sysMember.adjust.mutate({
      userId: props.data.userId,
      account: state.account,
      direction: state.direction,
      amount: toText(state.amount),
      reason: toText(state.reason),
      requestId: requestId.value,
      remark: toText(state.remark) || null
    })

    useToastSuccess($ts('module.system.member.adjustSuccess'))
    emit('saved')
    visible.value = false
  } finally {
    saving.value = false
  }
}

watch(visible, (opened) => {
  if (opened) {
    requestId.value = randomUuid()
    state.account = 'recharge'
    state.direction = 'in'
    state.amount = ''
    state.reason = ''
    state.remark = ''
  }
})
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="$ts('module.system.member.adjustTitle')"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[560px]', footer: 'justify-end' }"
  >
    <template #body>
      <UAlert
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="$ts('module.system.member.adjustTip')"
        :description="$ts('module.system.member.adjustTipDesc')"
      />

      <div class="mt-4 text-sm text-muted">
        {{ $ts('module.system.member.currentMember') }}：{{ data?.nickname || data?.userId || '-' }}
      </div>

      <UForm :state="state" class="mt-4 space-y-4">
        <UFormField name="account" required :label="$ts('module.system.member.accountLabel')">
          <USelect v-model="state.account" :items="accountItems" class="w-full" />
        </UFormField>
        <UFormField name="direction" required :label="$ts('module.system.member.directionLabel')">
          <USelect v-model="state.direction" :items="directionItems" class="w-full" />
        </UFormField>
        <UFormField name="amount" required :label="$ts('module.system.member.amount')">
          <UInput v-model="state.amount" type="number" step="0.01" min="0.01" :placeholder="$ts('module.system.member.form.amount')" class="w-full" />
        </UFormField>
        <UFormField name="reason" required :label="$ts('module.system.member.reason')" :help="$ts('module.system.member.reasonHelp')">
          <UBaseInput v-model="state.reason" :placeholder="$ts('module.system.member.form.reason')" trailing="clear" class="w-full" />
        </UFormField>
        <UFormField name="remark" :label="$ts('module.system.member.remark')">
          <UTextarea v-model="state.remark" :rows="2" :placeholder="$ts('module.system.member.form.remark')" class="w-full" />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <UButton color="neutral" variant="subtle" @click="visible = false">
        {{ $ts('common.cancel') }}
      </UButton>
      <UButton color="primary" :loading="saving" :disabled="!canSubmit" @click="save">
        {{ $ts('common.confirm') }}
      </UButton>
    </template>
  </UModal>
</template>
