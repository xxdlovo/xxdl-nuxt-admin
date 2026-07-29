<script setup lang="ts">
import type { RbacMenu } from '#shared/auth'
import PinToggler from './pin-toggler.vue'

const props = defineProps<{
  menus: RbacMenu[]
  visible?: boolean
  pinned?: boolean
  flatten?: boolean
  floating?: boolean
  width: number
  title?: string
}>()

const emit = defineEmits<{
  togglePin: []
  select: []
}>()

const items = computed(() => {
  if (!props.flatten) {
    return toNavigationItems(props.menus, () => emit('select'))
  }

  return getRenderableMenus(props.menus).map(menu => ({
    label: menu.name,
    icon: normalizeMenuIcon(menu.icon),
    to: findFirstPath(menu),
    exact: Boolean(menu.path),
    onSelect: () => emit('select')
  }))
})

const hasMenus = computed(() => props.menus.length > 0)
const open = computed(() => props.visible && hasMenus.value)
const reservedWidth = computed(() => props.pinned && hasMenus.value ? props.width : 0)
const panelWidth = computed(() => open.value ? props.width : 0)
const rootWidth = computed(() => props.floating ? panelWidth.value : reservedWidth.value)
const navigationMenuUi = {
  list: 'flex flex-col gap-1.5',
  link: 'min-h-10 gap-2 text-[15px] shadow-none before:shadow-none focus-visible:before:ring-0',
  linkLeadingIcon: 'size-6',
  linkTrailing: 'ms-auto inline-flex items-center',
  linkTrailingIcon: 'size-5 shrink-0 opacity-80',
  childList: 'flex flex-col gap-1.5',
  childLink: 'min-h-9 gap-2 text-[15px] shadow-none before:shadow-none focus-visible:before:ring-0',
  childLinkIcon: 'size-5'
}
</script>

<template>
  <div
    class="relative h-full shrink-0"
    :style="{ width: `${rootWidth}px` }"
  >
    <div
      class="top-0 z-50 h-full overflow-hidden bg-default"
      :class="[
        floating ? 'relative' : 'absolute left-0',
        open ? 'border-r border-default shadow-lg' : 'border-r-0 shadow-none'
      ]"
      :style="{ width: `${panelWidth}px` }"
    >
      <header class="flex h-14 items-center justify-between gap-2 px-3">
        <h2 class="truncate text-sm font-semibold text-primary">
          {{ title || 'Menu' }}
        </h2>
        <PinToggler :pinned="pinned" @click="emit('togglePin')" />
      </header>

      <div class="h-[calc(100%-56px)] overflow-y-auto px-2">
        <UNavigationMenu
          v-if="items.length > 0"
          orientation="vertical"
          :items="items"
          trailing-icon="i-lucide-chevron-down"
          tooltip
          popover
          :ui="navigationMenuUi"
        />
      </div>
    </div>
  </div>
</template>
