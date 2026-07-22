<script setup lang="ts">
import type { LayoutMode } from '#shared/layout'

const mode = defineModel<LayoutMode>('mode', { required: true })

defineProps<{
  disabled?: boolean
}>()

const { layoutModeOptions } = useLayoutMode()
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
    <button
      v-for="option in layoutModeOptions"
      :key="option.value"
      type="button"
      class="group flex h-full min-h-0 flex-col gap-2 rounded-md border border-default bg-default p-2 text-left outline-none transition-colors hover:bg-elevated/50 focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
      :class="mode === option.value ? 'border-primary ring-2 ring-primary/30' : ''"
      :disabled="disabled"
      @click="mode = option.value"
    >
      <div class="layout-mode-card-preview h-16 w-full overflow-hidden rounded bg-elevated p-1">
        <slot :name="option.value" :option="option" />
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
  </div>
</template>

<style scoped>
.layout-mode-card-preview :deep(.layout-sider),
.layout-mode-card-preview :deep(.layout-header),
.layout-mode-card-preview :deep(.layout-main) {
  border-radius: 2px;
}

.layout-mode-card-preview :deep(.vertical-wrapper) {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.layout-mode-card-preview :deep(.layout-header) {
  height: 10px;
}

.layout-mode-card-preview :deep(.layout-main) {
  min-height: 0;
  flex: 1;
}
</style>
