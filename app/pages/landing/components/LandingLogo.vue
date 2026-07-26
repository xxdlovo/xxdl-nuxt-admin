<script setup lang="ts">
defineProps<{
  name?: string
}>()
</script>

<template>
  <div class="flex items-center gap-2 text-highlighted">
    <img
      src="/favicon.ico"
      alt=""
      class="size-7 shrink-0"
      aria-hidden="true"
    >
    <span class="text-base font-semibold">{{ name || 'NuxtAdmin' }}</span>
  </div>
</template>
