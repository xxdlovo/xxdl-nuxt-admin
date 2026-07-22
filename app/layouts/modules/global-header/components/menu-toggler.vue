<script setup lang="ts">
defineProps<{
  collapsed?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <UTooltip :text="collapsed ? $ts('icon.expand') : $ts('icon.collapse')">
    <UButton
      :icon="collapsed ? 'icon-park:menu-unfold' : 'icon-park:menu-fold'"
      color="neutral"
      variant="ghost"
      square
      @click="emit('click')"
    />
  </UTooltip>
</template>
