<script setup lang="ts">
import type { SysMemberFreezeDto } from '#shared/system/memberFreeze'
import { useToastError, useToastInfo, useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const props = defineProps<{
  visible: boolean
  data?: SysMemberFreezeDto | null
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

  // 释放原因由服务端 Schema 强制必填（写入 release_reason），前端先拦一次
  reasonError.value = reason.value.trim() ? '' : $ts('module.system.memberFreeze.releaseReasonRequired')

  if (reasonError.value) {
    return
  }

  submitting.value = true

  try {
    const result = await $trpc.sysMemberFreeze.release.mutate({ id, reason: reason.value.trim() })

    if (result.reused) {
      useToastInfo($ts('module.system.memberFreeze.releaseReused'))
    } else {
      useToastSuccess($ts('module.system.memberFreeze.releaseSuccess'))
    }

    closeModal()
    await props.refresh?.()
  } catch (error) {
    // 保留弹窗让操作者修正，并把服务端返回的 message 一起提示
    useToastError($ts('module.system.memberFreeze.releaseFailed'), undefined, error instanceof Error ? error.message : '')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="$ts('module.system.memberFreeze.releaseTitle')"
    :dismissible="false"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[520px]', footer: 'justify-end gap-2' }"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="$ts('module.system.memberFreeze.releaseWarning')"
        />

        <UFormField :label="$ts('module.system.memberFreeze.bizNo')">
          <UInput :model-value="data?.bizNo ?? '-'" readonly color="neutral" variant="subtle" class="w-full" />
        </UFormField>

        <UFormField :label="$ts('module.system.memberFreeze.releaseReason')" required :error="reasonError || undefined">
          <UTextarea
            v-model="reason"
            :rows="3"
            autoresize
            :maxrows="6"
            :placeholder="$ts('module.system.memberFreeze.releaseReasonPlaceholder')"
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
