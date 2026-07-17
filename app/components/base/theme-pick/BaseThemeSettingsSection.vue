<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
}>()
</script>

<template>
  <section class="space-y-3">
    <div v-if="title || description || $slots.trailing" class="flex items-start justify-between gap-3">
      <div class="min-w-0 space-y-1">
        <p v-if="title" class="text-sm font-medium text-default">
          {{ title }}
        </p>
        <p v-if="description" class="text-sm text-muted">
          {{ description }}
        </p>
      </div>

      <div v-if="$slots.trailing" class="shrink-0">
        <slot name="trailing" />
      </div>
    </div>

    <slot />
  </section>
</template>
