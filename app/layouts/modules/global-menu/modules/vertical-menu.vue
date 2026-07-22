<script setup lang="ts">
import type { RbacMenu } from '#shared/auth'
import AppLogo from '../../global-logo/index.vue'
import AppHeader from '../../global-header/index.vue'
import LayoutContent from '../../global-content/index.vue'
import MobileSidebar from '../../global-sider/mobile-sidebar.vue'

const props = defineProps<{
  menus: RbacMenu[]
  loading?: boolean
  refreshKey: number
  mobile?: boolean
}>()

const open = defineModel<boolean>('open', { required: true })
const collapsed = defineModel<boolean>('collapsed', { required: true })
const themeStore = useThemeStore()

const items = computed(() => toNavigationItems(props.menus, () => {
  open.value = false
}))
const sidebarWidth = computed(() => collapsed.value ? themeStore.sider.collapsedWidth : themeStore.sider.width)

function toggleMenu() {
  if (props.mobile) {
    open.value = !open.value
    return
  }

  collapsed.value = !collapsed.value
}
</script>

<template>
  <UDashboardGroup unit="rem">
    <MobileSidebar v-model:open="open" :menus="menus" :loading="loading" />

    <UDashboardSidebar
      id="default"
      v-model:collapsed="collapsed"
      class="hidden lg:flex"
      collapsible
      resizable
      :style="{ '--app-sider-width': `${sidebarWidth}px` }"
      :ui="{ root: '!w-[var(--app-sider-width)]', footer: 'lg:border-t lg:border-default' }"
    >
      <template #header>
        <AppLogo :show-title="!collapsed" />
      </template>

      <template #default="{ collapsed: slotCollapsed }">
        <div v-if="loading" class="flex items-center gap-2 px-2 py-1.5 text-sm text-muted">
          <UIcon name="i-lucide-loader-circle" class="animate-spin" />
          <span v-if="!slotCollapsed">Loading</span>
        </div>

        <UNavigationMenu
          v-else-if="items.length > 0"
          :collapsed="slotCollapsed"
          :items="items"
          orientation="vertical"
          tooltip
          popover
        />

        <div v-else class="px-2 py-1.5 text-sm text-muted">
          <span v-if="!slotCollapsed">No menus</span>
          <UIcon v-else name="i-lucide-circle-off" />
        </div>
      </template>
    </UDashboardSidebar>

    <LayoutContent :refresh-key="refreshKey">
      <template #header>
        <AppHeader :collapsed="props.mobile ? !open : collapsed" show-menu-toggler @toggle-menu="toggleMenu" />
      </template>
      <slot />
    </LayoutContent>
  </UDashboardGroup>
</template>
