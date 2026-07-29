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
const route = useRoute()
const themeStore = useThemeStore()

const topLevelActiveClass = 'before:!bg-transparent shadow-none hover:before:!bg-transparent active:before:!bg-transparent focus-visible:before:!bg-transparent'
const activeTrail = computed(() => resolveActiveTrail(getRenderableMenus(props.menus), route.path))
const items = computed(() => getRenderableMenus(props.menus).map((menu) => {
  const item = toNavigationItem(menu, () => {
    open.value = false
  })

  return {
    ...item,
    active: activeTrail.value[0]?.id === menu.id,
    ui: {
      ...item.ui,
      link: [item.ui?.link, activeTrail.value[0]?.id === menu.id ? topLevelActiveClass : undefined].filter(Boolean).join(' ')
    }
  }
}))
const sidebarWidth = computed(() => collapsed.value ? themeStore.sider.collapsedWidth : themeStore.sider.width)
const navigationMenuUi = computed(() => ({
  list: 'flex flex-col gap-1.5',
  link: 'min-h-10 gap-2 text-[15px] shadow-none before:shadow-none focus-visible:before:ring-0',
  linkLeadingIcon: 'size-6',
  linkTrailing: collapsed.value ? 'hidden' : 'ms-auto inline-flex items-center',
  linkTrailingIcon: 'size-5 shrink-0 opacity-80',
  childList: 'flex flex-col gap-1.5',
  childLink: 'min-h-9 gap-2 text-[15px] shadow-none before:shadow-none focus-visible:before:ring-0',
  childLinkIcon: 'size-5'
}))

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
      :ui="{
        root: '!w-[var(--app-sider-width)]',
        header: collapsed ? '!px-0 justify-center' : undefined,
        footer: 'lg:border-t lg:border-default'
      }"
    >
      <template #header>
        <AppLogo :show-title="!collapsed" :collapsed="collapsed" />
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
          trailing-icon="i-lucide-chevron-down"
          tooltip
          popover
          :ui="navigationMenuUi"
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
