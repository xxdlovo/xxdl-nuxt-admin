<!--分割设置的不同部分-->
<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
}>()
</script>

<template>
  <section class="space-y-3">
    <USeparator
      v-if="title"
      :label="title"
      orientation="horizontal"
      color="neutral"
      size="xs"
      position="center"
    />

    <div v-if="description || $slots.trailing" class="flex items-start justify-between gap-3">
      <p v-if="description" class="min-w-0 text-sm text-muted">
        {{ description }}
      </p>

      <div v-if="$slots.trailing" class="shrink-0">
        <slot name="trailing" />
      </div>
    </div>

    <slot />
  </section>
</template>
