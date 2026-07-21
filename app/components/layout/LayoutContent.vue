<script setup lang="ts">
defineProps<{
  refreshKey: number
}>()
</script>

<template>
  <UDashboardPanel id="home" :ui="{ body: 'p-0 sm:p-0 gap-0 sm:gap-0' }">
    <template #header>
      <slot name="header" />
      <AppTabsBar />
    </template>

    <template #body>
      <div :key="refreshKey" class="flex-1 min-h-0 overflow-auto">
        <slot />
      </div>
    </template>

    <template #footer>
      <div class="text-center">
        PowerBy nuxt
      </div>
    </template>
  </UDashboardPanel>
</template>
