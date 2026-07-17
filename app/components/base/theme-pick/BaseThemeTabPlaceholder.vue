<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  description: string
}>()
</script>

<template>
  <UAlert
    :icon="icon"
    :title="title"
    :description="description"
    color="neutral"
    variant="soft"
  />
</template>
