<script setup lang="ts">
import type { RbacMenu } from '#shared/auth'
import type { NavigationMenuItem } from '@nuxt/ui'
import AppHeader from '../../global-header/index.vue'
import AppLogo from '../../global-logo/index.vue'
import LayoutContent from '../../global-content/index.vue'
import MobileSidebar from '../../global-sider/mobile-sidebar.vue'
import FirstLevelMenu from '../components/first-level-menu.vue'
import MixChildDrawer from '../components/mix-child-drawer.vue'

const props = defineProps<{
  menus: RbacMenu[]
  loading?: boolean
  refreshKey: number
}>()

const open = defineModel<boolean>('open', { required: true })
const collapsed = defineModel<boolean>('collapsed', { required: true })
const route = useRoute()
const themeStore = useThemeStore()
const drawerVisible = ref(false)
const drawerActivated = ref(false)
const siderVisible = ref(false)
const hybridSiderCollapsed = ref(false)
let idleTimer: ReturnType<typeof setTimeout> | null = null

const {
  firstLevelMenus,
  secondLevelMenus,
  activeSecondLevelMenu,
  childLevelMenus,
  isActiveFirstLevelMenuHasChildren,
  hasChildLevelMenus,
  activateFirstLevelMenu,
  activateSecondLevelMenu,
  selectSecondLevelMenu,
  navigateMenu
} = useMixMenu(() => props.menus)

const renderableSecondLevelMenus = computed(() => getRenderableMenus(secondLevelMenus.value))
const headerItems = computed<NavigationMenuItem[]>(() => firstLevelMenus.value.map(menu => ({
  label: menu.name,
  icon: normalizeMenuIcon(menu.icon),
  onSelect: () => handleSelectFirst(menu)
})))
const showDrawer = computed(() => {
  return drawerActivated.value && hasChildLevelMenus.value && (drawerVisible.value || themeStore.mixSiderFixed)
})
const siderWidth = computed(() => hybridSiderCollapsed.value ? themeStore.sider.mixCollapsedWidth : themeStore.sider.mixWidth)
const overlayBounds = computed(() => ({
  top: '0px',
  bottom: '0px'
}))
const showFloatingSider = computed(() => siderVisible.value && isActiveFirstLevelMenuHasChildren.value)
const layoutOffset = computed(() => showFloatingSider.value ? `${siderWidth.value}px` : '0px')

function clearIdleTimer() {
  if (!idleTimer) {
    return
  }

  window.clearTimeout(idleTimer)
  idleTimer = null
}

function scheduleAutoHide() {
  clearIdleTimer()

  if (!showFloatingSider.value || themeStore.mixSiderFixed) {
    return
  }

  idleTimer = window.setTimeout(() => {
    siderVisible.value = false
    drawerVisible.value = false
    drawerActivated.value = false
  }, 5000)
}

function showFloatingSecondMenus() {
  siderVisible.value = true
  drawerVisible.value = false
  drawerActivated.value = false
  scheduleAutoHide()
}

function hideFloatingMenus() {
  clearIdleTimer()
  siderVisible.value = false
  drawerVisible.value = false
  drawerActivated.value = false
}

async function handleSelectFirst(menu: RbacMenu) {
  if (menu.type !== 0) {
    hideFloatingMenus()
    void navigateMenu(menu)
    return
  }

  activateFirstLevelMenu(menu)
  drawerActivated.value = false

  if (getRenderableMenus(menu.children).length > 0) {
    showFloatingSecondMenus()
    return
  }

  hideFloatingMenus()
  void navigateMenu(menu)
}

async function handleSelectSecond(menu: RbacMenu) {
  siderVisible.value = true
  activateSecondLevelMenu(menu)
  if (getRenderableMenus(menu.children).length > 0) {
    drawerActivated.value = true
    drawerVisible.value = true
    scheduleAutoHide()
    return
  }

  drawerActivated.value = false
  drawerVisible.value = false

  if (!themeStore.mixSiderFixed) {
    hideFloatingMenus()
  }

  void selectSecondLevelMenu(menu)
  scheduleAutoHide()
}

function handleDrawerSelect() {
  if (themeStore.mixSiderFixed) {
    drawerVisible.value = false
    drawerActivated.value = false
    return
  }

  hideFloatingMenus()
}

function handleMouseLeave() {
  scheduleAutoHide()
}

function handleSiderActivity() {
  siderVisible.value = true
  scheduleAutoHide()
}

function handleTogglePin() {
  themeStore.toggleMixSiderFixed()

  if (themeStore.mixSiderFixed) {
    clearIdleTimer()
    return
  }

  scheduleAutoHide()
}

onBeforeUnmount(clearIdleTimer)

watch(
  () => route.path,
  () => {
    if (!themeStore.mixSiderFixed) {
      hideFloatingMenus()
    }
  }
)
</script>

<template>
  <UDashboardGroup unit="rem">
    <MobileSidebar v-model:open="open" :menus="menus" :loading="loading" />

    <aside
      v-if="showFloatingSider"
      class="fixed inset-y-0 left-0 z-50 hidden h-screen min-h-0 shrink-0 flex-col border-r border-default bg-default shadow-lg outline-none lg:flex"
      :style="{ ...overlayBounds, width: `${siderWidth}px` }"
      @mouseenter="handleSiderActivity"
      @mouseleave="handleMouseLeave"
      @mousemove="handleSiderActivity"
    >
      <AppLogo :show-title="false" class="h-14 shrink-0 justify-center" />
      <div class="min-h-0 flex-1">
        <FirstLevelMenu
          :menus="renderableSecondLevelMenus"
          :active-id="activeSecondLevelMenu?.id"
          :collapsed="hybridSiderCollapsed"
          inverted
          show-collapse
          @select="handleSelectSecond"
          @toggle-collapse="hybridSiderCollapsed = !hybridSiderCollapsed"
        />
      </div>
    </aside>

    <MixChildDrawer
      v-if="showFloatingSider"
      class="fixed z-50 !h-auto"
      :style="{ ...overlayBounds, left: `${siderWidth}px` }"
      :menus="childLevelMenus"
      :visible="showDrawer"
      :pinned="themeStore.mixSiderFixed"
      flatten
      floating
      :width="themeStore.sider.mixChildMenuWidth"
      :title="activeSecondLevelMenu?.name"
      @toggle-pin="handleTogglePin"
      @select="handleDrawerSelect"
      @mouseenter="handleSiderActivity"
      @mousemove="handleSiderActivity"
      @mouseleave="handleMouseLeave"
    />

    <div
      class="hidden min-w-0 flex-1 flex-col lg:flex"
      :style="{ paddingLeft: layoutOffset }"
    >
      <AppHeader :show-logo="!showFloatingSider" show-logo-title show-menu>
        <template #menu>
          <UNavigationMenu orientation="horizontal" :items="headerItems" />
        </template>
      </AppHeader>

      <div class="relative flex min-h-0 flex-1">
        <LayoutContent :refresh-key="refreshKey">
          <slot />
        </LayoutContent>
      </div>
    </div>

    <LayoutContent class="lg:hidden" :refresh-key="refreshKey">
      <template #header>
        <AppHeader :collapsed="collapsed" show-menu-toggler @toggle-menu="open = !open" />
      </template>
      <slot />
    </LayoutContent>
  </UDashboardGroup>
</template>
