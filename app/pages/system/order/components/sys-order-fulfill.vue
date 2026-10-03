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

const remark = ref('')
const submitting = ref(false)

watch(visible, (opened) => {
  if (opened) {
    remark.value = ''
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

  submitting.value = true

  try {
    // 交付说明可选，留空表示只做状态推进
    await $trpc.sysOrder.fulfill.mutate({ id, remark: remark.value.trim() || null })
    useToastSuccess($ts('module.system.order.fulfillSuccess'))
    closeModal()
    await props.refresh?.()
  } catch (error) {
    // 保留弹窗让操作者修正，并把服务端返回的 message 一起提示
    useToastError($ts('module.system.order.fulfillFailed'), undefined, error instanceof Error ? error.message : '')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="$ts('module.system.order.fulfillTitle')"
    :dismissible="false"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[520px]', footer: 'justify-end gap-2' }"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          color="primary"
          variant="subtle"
          icon="i-lucide-package-check"
          :title="$ts('module.system.order.fulfillWarning')"
        />

        <UFormField :label="$ts('module.system.order.orderNo')">
          <UInput :model-value="data?.orderNo ?? '-'" readonly color="neutral" variant="subtle" class="w-full" />
        </UFormField>

        <UFormField :label="$ts('module.system.order.goods')">
          <UInput :model-value="data?.goodsName ?? '-'" readonly color="neutral" variant="subtle" class="w-full" />
        </UFormField>

        <UFormField :label="$ts('module.system.order.fulfillRemark')">
          <UTextarea
            v-model="remark"
            :rows="3"
            autoresize
            :maxrows="6"
            :placeholder="$ts('module.system.order.fulfillRemarkPlaceholder')"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <UButton color="neutral" variant="subtle" :disabled="submitting" @click="closeModal">
        {{ $ts('common.cancel') }}
      </UButton>
      <UButton color="primary" :loading="submitting" @click="submit">
        {{ $ts('common.confirm') }}
      </UButton>
    </template>
  </UModal>
</template>
