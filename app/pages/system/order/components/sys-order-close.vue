<script setup lang="ts">
import type { SysOrderRespDTO } from '#shared/system/order'
import { useToastError, useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const props = defineProps<{
  visible: boolean
  data?: SysOrderRespDTO | null
  refresh?: () => void | Promise<void>
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

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

  // 关闭原因要写入订单留痕，前端先拦一次，避免发出必填字段为空的请求
  reasonError.value = reason.value.trim() ? '' : $ts('module.system.order.closeReasonRequired')

  if (reasonError.value) {
    return
  }

  submitting.value = true

  try {
    await $trpc.sysOrder.close.mutate({ id, reason: reason.value.trim() })
    useToastSuccess($ts('module.system.order.closeSuccess'))
    closeModal()
    await props.refresh?.()
  } catch (error) {
    // 保留弹窗让操作者修正，并把服务端返回的 message 一起提示
    useToastError($ts('module.system.order.closeFailed'), undefined, error instanceof Error ? error.message : '')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="$ts('module.system.order.closeTitle')"
    :dismissible="false"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[520px]', footer: 'justify-end gap-2' }"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="$ts('module.system.order.closeWarning')"
          :description="$ts('module.system.order.closeWarningDesc')"
        />

        <UFormField :label="$ts('module.system.order.orderNo')">
          <UInput :model-value="data?.orderNo ?? '-'" readonly color="neutral" variant="subtle" class="w-full" />
        </UFormField>

        <UFormField :label="$ts('module.system.order.payAmount')">
          <UInput :model-value="data?.payAmount != null ? `¥${data.payAmount}` : '-'" readonly color="neutral" variant="subtle" class="w-full" />
        </UFormField>

        <UFormField :label="$ts('module.system.order.closeReason')" required :error="reasonError || undefined">
          <UTextarea
            v-model="reason"
            :rows="3"
            autoresize
            :maxrows="6"
            :placeholder="$ts('module.system.order.closeReasonPlaceholder')"
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
