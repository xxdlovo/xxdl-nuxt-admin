<script setup lang="ts">
const { $ts } = useI18n()
</script>

<template>
  <div class="space-y-4">
    <UAlert
      icon="i-lucide-sparkles"
      title="Preset"
      :description="$ts('common.lookForward')"
      color="neutral"
      variant="soft"
    />
  </div>
</template>
