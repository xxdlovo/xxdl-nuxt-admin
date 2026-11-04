<script setup lang="ts">
defineProps<{
  pinned?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <UTooltip :text="pinned ? $ts('common.cancel') : $ts('common.config')">
    <UButton
      :icon="pinned ? 'i-lucide-pin-off' : 'i-lucide-pin'"
      color="neutral"
      variant="ghost"
      size="xs"
      square
      @click="emit('click')"
    />
  </UTooltip>
</template>
