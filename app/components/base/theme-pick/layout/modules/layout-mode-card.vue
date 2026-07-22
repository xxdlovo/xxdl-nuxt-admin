<script setup lang="ts">
import type { LayoutModeOption } from '#shared/layout'

const props = defineProps<{
  option: LayoutModeOption
  selected?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

const previewClass = computed(() => {
  const value = props.option.value

  if (value === 'vertical') {
    return {
      shell: 'grid-cols-[18px_1fr] grid-rows-1',
      main: 'col-start-1 row-start-1',
      rail: 'col-start-2 row-start-1'
    }
  }

  if (value === 'vertical-mix' || value === 'top-hybrid-sidebar-first') {
    return {
      shell: 'grid-cols-[10px_10px_1fr] grid-rows-1',
      main: 'col-start-3 row-start-1',
      rail: 'col-start-1 row-start-1',
      railSoft: 'col-start-2 row-start-1'
    }
  }

  if (value === 'vertical-hybrid-header-first') {
    return {
      shell: 'grid-cols-[10px_10px_1fr] grid-rows-[10px_1fr]',
      main: 'col-start-3 row-start-2',
      rail: 'col-start-1 row-start-2',
      railSoft: 'col-start-2 row-start-2',
      header: 'col-span-3 row-start-1'
    }
  }

  if (value === 'top-hybrid-header-first') {
    return {
      shell: 'grid-cols-[18px_1fr] grid-rows-[10px_1fr]',
      main: 'col-start-2 row-start-2',
      rail: 'col-start-1 row-start-2',
      header: 'col-span-2 row-start-1'
    }
  }

  if (value === 'top-hybrid-sidebar-first') {
    return {
      shell: 'grid-cols-[18px_1fr] grid-rows-[10px_1fr]',
      main: 'col-start-2 row-start-2',
      rail: 'col-start-1 row-start-2',
      header: 'col-span-2 row-start-1'
    }
  }

  return {
    shell: 'grid-cols-1 grid-rows-[10px_1fr]',
    main: 'col-start-1 row-start-2',
    header: 'col-start-1 row-start-1'
  }
})
</script>

<template>
  <button
    type="button"
    class="group flex h-full min-h-0 flex-col gap-2 rounded-md border border-default bg-default p-2 text-left outline-none transition-colors hover:bg-elevated/50 focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
    :class="selected ? 'border-primary ring-2 ring-primary/30' : ''"
    :disabled="disabled"
    @click="emit('click')"
  >
    <div class="grid h-16 w-full gap-1 rounded bg-elevated p-1" :class="previewClass.shell">
      <div
        v-if="previewClass.header"
        class="rounded-sm bg-primary"
        :class="previewClass.header"
      />
      <div
        v-if="previewClass.rail"
        class="rounded-sm bg-primary"
        :class="previewClass.rail"
      />
      <div
        v-if="previewClass.railSoft"
        class="rounded-sm bg-primary/35"
        :class="previewClass.railSoft"
      />
      <div
        class="rounded-sm bg-primary/25"
        :class="previewClass.main"
      />
    </div>

    <div class="space-y-0.5">
      <p class="line-clamp-1 text-xs font-medium text-default">
        {{ option.label }}
      </p>
      <p class="line-clamp-2 text-[11px] leading-4 text-muted">
        {{ option.description }}
      </p>
    </div>
  </button>
</template>
