<script setup lang="ts">
defineProps<{
  src: string
  alt: string
  title?: string
}>()

const open = ref(false)
</script>

<template>
  <button
    type="button"
    class="group block w-full cursor-zoom-in overflow-hidden text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"
    :aria-label="title || alt"
    @click="open = true"
  >
    <slot />
  </button>

  <UModal
    v-model:open="open"
    :title="title || alt"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-6xl', body: 'p-2 sm:p-3' }"
  >
    <template #body>
      <img
        :src="src"
        :alt="alt"
        class="max-h-[calc(100dvh-9rem)] w-full rounded-md object-contain"
      >
    </template>
  </UModal>
</template>
