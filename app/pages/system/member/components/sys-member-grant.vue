<script setup lang="ts">
import { randomUuid } from '#shared/utils/uuid'
import { memberGiftSourceRecord } from '#shared/constants/business'
import { useToastSuccess } from '~/utils/toast'

/**
 * 发放赠送金弹窗：系统赠送 / 活动赠送。
 * `expireAt` 留空表示永久有效；`requestId` 保证重复提交只发一次。
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
const expireDate = ref('')

const state = reactive<{
  amount: string
  source: 'system' | 'campaign'
  remark: string
}>({
  amount: '',
  source: 'system',
  remark: ''
})

const sourceItems = useTransformRecordToOption(memberGiftSourceRecord)

const canSubmit = computed(() => Boolean(state.amount.trim()))

const save = async () => {
  if (!props.data?.userId || !canSubmit.value) {
    return
  }

  saving.value = true

  try {
    await $trpc.sysMember.grant.mutate({
      userId: props.data.userId,
      amount: state.amount.trim(),
      source: state.source,
      // 后端按 YYYY-MM-DD HH:mm:ss 比较，日期选择器补全到当天 23:59:59
      expireAt: expireDate.value ? `${expireDate.value} 23:59:59` : null,
      requestId: requestId.value,
      remark: state.remark.trim() || null
    })

    useToastSuccess($ts('module.system.member.grantSuccess'))
    emit('saved')
    visible.value = false
  } finally {
    saving.value = false
  }
}

watch(visible, (opened) => {
  if (opened) {
    requestId.value = randomUuid()
    state.amount = ''
    state.source = 'system'
    state.remark = ''
    expireDate.value = ''
  }
})
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="$ts('module.system.member.grantTitle')"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[560px]', footer: 'justify-end' }"
  >
    <template #body>
      <UAlert
        color="info"
        variant="subtle"
        icon="i-lucide-gift"
        :title="$ts('module.system.member.grantTip')"
        :description="$ts('module.system.member.grantTipDesc')"
      />

      <div class="mt-4 text-sm text-muted">
        {{ $ts('module.system.member.currentMember') }}：{{ data?.nickname || data?.userId || '-' }}
      </div>

      <UForm :state="state" class="mt-4 space-y-4">
        <UFormField name="amount" required :label="$ts('module.system.member.amount')">
          <UInput v-model="state.amount" type="number" step="0.01" min="0.01" :placeholder="$ts('module.system.member.form.amount')" class="w-full" />
        </UFormField>
        <UFormField name="source" required :label="$ts('module.system.member.giftSourceLabel')">
          <USelect v-model="state.source" :items="sourceItems" class="w-full" />
        </UFormField>
        <UFormField name="expireAt" :label="$ts('module.system.member.expireAt')" :help="$ts('module.system.member.expireAtHelp')">
          <UInput v-model="expireDate" type="date" class="w-full" />
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
