<script setup lang="ts">
import ThemeDrawer from '~/layouts/modules/theme-drawer/index.vue'

const open = ref(false)
</script>

<template>
  <ThemeDrawer v-model:open="open">
    <template #trigger>
      <UButton
        icon="i-lucide-swatch-book"
        color="neutral"
        :variant="open ? 'soft' : 'ghost'"
        square
        aria-label="Theme settings"
        :ui="{ leadingIcon: 'text-primary' }"
      />
    </template>
  </ThemeDrawer>
</template>
