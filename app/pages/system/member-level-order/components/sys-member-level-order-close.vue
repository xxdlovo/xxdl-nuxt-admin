<script setup lang="ts">
import { useToastError, useToastSuccess } from '~/utils/toast'
import type { MemberLevelOrderRow } from './types'

/**
 * 关闭会员开通单：只允许关闭待支付（WP）的单据，必须填写关闭原因。
 * 关闭后等级不会生效，若已占用余额冻结会在服务端一并释放（与充值单关闭同一套语义）。
 */
const props = defineProps<{
  visible: boolean
  data?: MemberLevelOrderRow | null
  refresh?: () => void | Promise<void>
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const reason = ref('')
const reasonError = ref('')
const submitting = ref(false)

watch(visible, (opened) => {
  if (opened) {
    reason.value = ''
    reasonError.value = ''
  }
})

const closeModal = () => {
  visible.value = false
}

const submit = async () => {
  const id = props.data?.id

  if (!id || submitting.value) {
    return
  }

  // 关闭原因会写入 fail_reason 留痕，前端先拦一次，避免发出必填为空的请求
  reasonError.value = reason.value.trim() ? '' : $ts('module.system.memberLevelOrder.closeReasonRequired')

  if (reasonError.value) {
    return
  }

  submitting.value = true

  try {
    await $trpc.sysMemberLevelOrder.close.mutate({ id, reason: reason.value.trim() })
    useToastSuccess($ts('module.system.memberLevelOrder.closeSuccess'))
    closeModal()
    await props.refresh?.()
  } catch (error) {
    // 保留弹窗让操作者修正，并把服务端返回的 message 一起提示
    useToastError($ts('module.system.memberLevelOrder.closeFailed'), undefined, error instanceof Error ? error.message : '')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="$ts('module.system.memberLevelOrder.closeTitle')"
    :dismissible="false"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[520px]', footer: 'justify-end gap-2' }"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="$ts('module.system.memberLevelOrder.closeWarning')"
        />

        <UFormField :label="$ts('module.system.memberLevelOrder.outTradeNo')">
          <UInput :model-value="data?.outTradeNo ?? '-'" readonly color="neutral" variant="subtle" class="w-full" />
        </UFormField>

        <UFormField :label="$ts('module.system.memberLevelOrder.closeReason')" required :error="reasonError || undefined">
          <UTextarea
            v-model="reason"
            :rows="3"
            autoresize
            :maxrows="6"
            :placeholder="$ts('module.system.memberLevelOrder.closeReasonPlaceholder')"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <UButton color="neutral" variant="subtle" :disabled="submitting" @click="closeModal">
        {{ $ts('common.cancel') }}
      </UButton>
      <UButton color="warning" :loading="submitting" @click="submit">
        {{ $ts('common.confirm') }}
      </UButton>
    </template>
  </UModal>
</template>
