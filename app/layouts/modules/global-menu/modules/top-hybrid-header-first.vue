<script setup lang="ts">
import type { RbacMenu } from '#shared/auth'
import AppHeader from '../../global-header/index.vue'
import LayoutContent from '../../global-content/index.vue'
import MobileSidebar from '../../global-sider/mobile-sidebar.vue'

const props = defineProps<{
  menus: RbacMenu[]
  loading?: boolean
  refreshKey: number
}>()

const open = defineModel<boolean>('open', { required: true })
const collapsed = defineModel<boolean>('collapsed', { required: true })
const themeStore = useThemeStore()

const {
  firstLevelMenus,
  activeFirstLevelMenu,
  secondLevelMenus,
  isActiveFirstLevelMenuHasChildren,
  activateFirstLevelMenu,
  selectFirstLevelMenuAndGoDeepest
} = useMixMenu(() => props.menus)

const sideItems = computed(() => toNavigationItems(secondLevelMenus.value))
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
const activeTopMenuClass = '!bg-transparent text-primary shadow-none hover:!bg-transparent active:!bg-transparent focus-visible:!bg-transparent'
const sideWidth = computed(() => {
  if (!isActiveFirstLevelMenuHasChildren.value) {
    return 0
  }

  return collapsed.value ? themeStore.sider.collapsedWidth : themeStore.sider.width
})

function isActiveTopMenu(menu: RbacMenu) {
  return activeFirstLevelMenu.value?.id === menu.id
}

function handleSelectFirstLevel(menu: RbacMenu) {
  if (menu.type === 0) {
    activateFirstLevelMenu(menu)
    return
  }

  void selectFirstLevelMenuAndGoDeepest(menu)
}
</script>

<template>
  <UDashboardGroup unit="rem">
    <MobileSidebar v-model:open="open" :menus="menus" :loading="loading" />

    <div class="flex min-w-0 flex-1 flex-col">
      <AppHeader
        show-logo
        show-logo-title
        show-menu
        :show-menu-toggler="isActiveFirstLevelMenuHasChildren"
        :collapsed="collapsed"
        @toggle-menu="collapsed = !collapsed"
      >
        <template #menu>
          <div class="flex min-w-0 items-center gap-1">
            <UButton
              v-for="menu in firstLevelMenus"
              :key="menu.id"
              :label="menu.name"
              :icon="normalizeMenuIcon(menu.icon)"
              color="neutral"
              variant="ghost"
              :class="isActiveTopMenu(menu) ? activeTopMenuClass : ''"
              @click="handleSelectFirstLevel(menu)"
            />
          </div>
        </template>
      </AppHeader>

      <div class="flex min-h-0 flex-1">
        <aside
          class="hidden shrink-0 overflow-hidden border-r border-default bg-default transition-[width] duration-300 lg:block"
          :style="{ width: `${sideWidth}px` }"
        >
          <div class="h-full overflow-y-auto p-2">
            <UNavigationMenu
              :items="sideItems"
              :collapsed="collapsed"
              orientation="vertical"
              trailing-icon="i-lucide-chevron-down"
              tooltip
              popover
              :ui="navigationMenuUi"
            />
          </div>
        </aside>

        <LayoutContent :refresh-key="refreshKey">
          <slot />
        </LayoutContent>
      </div>
    </div>
  </UDashboardGroup>
</template>
