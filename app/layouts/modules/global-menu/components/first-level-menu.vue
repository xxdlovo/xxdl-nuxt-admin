<script setup lang="ts">
import type { RbacMenu } from '#shared/auth'

defineProps<{
  menus: RbacMenu[]
  collapsed?: boolean
  activeId?: string | null
  inverted?: boolean
  showCollapse?: boolean
}>()

const emit = defineEmits<{
  select: [menu: RbacMenu]
  toggleCollapse: []
}>()

function blurCurrentTarget(event: MouseEvent) {
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.blur()
  }
}

function handleSelect(menu: RbacMenu, event: MouseEvent) {
  blurCurrentTarget(event)
  emit('select', menu)
}

function handleToggleCollapse(event: MouseEvent) {
  blurCurrentTarget(event)
  emit('toggleCollapse')
}

const buttonUi = {
  leadingIcon: 'size-6'
}
</script>

<template>
  <div class="first-level-menu flex h-full min-h-0 flex-col">
    <div class="min-h-0 flex-1 overflow-y-auto px-2 py-2">
      <div class="flex flex-col gap-2">
        <UTooltip v-for="menu in menus" :key="menu.id" :text="menu.name" :delay-duration="0">
          <UButton
            :icon="normalizeMenuIcon(menu.icon)"
            :label="collapsed ? undefined : menu.name"
            color="neutral"
            variant="ghost"
            :square="collapsed"
            size="xl"
            block
            :ui="buttonUi"
            class="min-h-11 justify-center outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
            :class="[
              collapsed ? 'px-0' : 'flex-col gap-1.5 px-1 py-2 text-sm',
              inverted ? 'text-default hover:bg-elevated' : '',
              activeId === menu.id ? '!bg-transparent text-primary shadow-none hover:!bg-transparent active:!bg-transparent focus-visible:!bg-transparent' : ''
            ]"
            @click="handleSelect(menu, $event)"
          />
        </UTooltip>
      </div>
    </div>

    <div v-if="showCollapse !== false" class="border-t border-default">
      <UButton
        :icon="collapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
        color="neutral"
        variant="soft"
        square
        block
        class="outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
        @click="handleToggleCollapse"
      />
    </div>
  </div>
</template>

<style scoped>
.first-level-menu :deep(button),
.first-level-menu :deep(a),
.first-level-menu :deep([role='button']),
.first-level-menu :deep([tabindex]) {
  outline: none !important;
  box-shadow: none;
}

.first-level-menu :deep(button:focus),
.first-level-menu :deep(button:focus-visible),
.first-level-menu :deep(a:focus),
.first-level-menu :deep(a:focus-visible),
.first-level-menu :deep([role='button']:focus),
.first-level-menu :deep([role='button']:focus-visible),
.first-level-menu :deep([tabindex]:focus),
.first-level-menu :deep([tabindex]:focus-visible) {
  outline: none !important;
  box-shadow: none !important;
}

.first-level-menu :deep(*:focus),
.first-level-menu :deep(*:focus-visible) {
  outline: none !important;
}
</style>
