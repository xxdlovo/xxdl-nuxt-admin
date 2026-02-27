<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

interface Props {
  content?: string
  positiveText?: string
  negativeText?: string
  loading?: boolean
}

const { $ts } = useI18n()

const props = withDefaults(defineProps<Props>(), {
  content: '',
  positiveText: '',
  negativeText: '',
  loading: false
})

const emit = defineEmits<{
  (e: 'confirm'): void | Promise<void>
}>()

const show = ref(false)
const isConfirming = ref(false)

// 计算国际化文本
const displayContent = computed(() => props.content || $ts('common.confirmDelete'))
const displayPositiveText = computed(() => props.positiveText || $ts('common.delete'))
const displayNegativeText = computed(() => props.negativeText || $ts('common.cancel'))

const handleConfirm = () => {
  isConfirming.value = true
  emit('confirm')

  // 如果没有 loading，立即关闭
  if (!props.loading) {
    nextTick(() => {
      show.value = false
      isConfirming.value = false
    })
  }
}

const handleCancel = () => {
  show.value = false
  isConfirming.value = false
}

// 监听 loading 变化，当 loading 完成后关闭对话框
watch(() => props.loading, (newLoading) => {
  // 当从 loading 变为非 loading，且之前点击了确认时，关闭对话框
  if (!newLoading && isConfirming.value) {
    nextTick(() => {
      show.value = false
      isConfirming.value = false
    })
  }
})
</script>

<template>
  <UPopover
      v-model:open="show"
      :popper="{ placement: 'top' }"
  >
    <!-- 触发器 -->
    <slot name="trigger" />

    <!-- 内容 -->
    <template #content>
      <div class="p-3 w-56">
        <p class="text-sm text-gray-600 mb-3">
          {{ displayContent }}
        </p>

        <div class="flex justify-end gap-2">
          <UButton
              size="xs"
              variant="soft"
              color="neutral"
              @click="handleCancel"
          >
            {{ displayNegativeText }}
          </UButton>

          <UButton
              size="xs"
              color="error"
              :loading="loading"
              @click="handleConfirm"
          >
            {{ displayPositiveText }}
          </UButton>
        </div>
      </div>
    </template>
  </UPopover>
</template>