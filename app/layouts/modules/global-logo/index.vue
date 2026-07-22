<script setup lang="ts">
defineProps<{
  showTitle?: boolean
}>()
</script>

<template>
  <div class="flex min-w-0 items-center gap-2 px-3">
    <UIcon name="i-tabler:brand-nuxt" size="2em" class="shrink-0 text-primary" />
    <span v-if="showTitle !== false" class="truncate font-semibold text-primary">Nuxt Admin</span>
  </div>
</template>
