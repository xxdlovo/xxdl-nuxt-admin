<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { NavigationMenuItem } from '@nuxt/ui'
import type { RbacMenu } from '#shared/auth'
import { useTabsStore } from '~/stores/tabs'

const toast = useToast()
const { profile, loading: menuLoading, loadProfile } = useRbacProfile()
const tabsStore = useTabsStore()
const { refreshKey } = storeToRefs(tabsStore)

// 侧栏弹层与折叠态，分别对应移动端展开和桌面端收起
const open = ref(false)
const sidebarCollapsed = ref(false)
const isSmallScreen = ref(false)
const sidebarToggleCollapsed = computed(() => isSmallScreen.value ? !open.value : sidebarCollapsed.value)

let smallScreenMedia: MediaQueryList | null = null

function syncSmallScreen(value: boolean) {
  isSmallScreen.value = value

  if (!value) {
    open.value = false
  }
}

function toggleSidebar() {
  if (isSmallScreen.value) {
    open.value = !open.value
    return
  }

  sidebarCollapsed.value = !sidebarCollapsed.value
}

function handleSmallScreenChange(event: MediaQueryListEvent) {
  syncSmallScreen(event.matches)
}

function closeSidebar() {
  open.value = false
}

function normalizeMenuIcon(icon?: string | null) {
  return icon || 'i-lucide-circle'
}

function toNavigationItem(menu: RbacMenu): NavigationMenuItem {
  const children = menu.children.map(toNavigationItem)
  const clickable = menu.type !== 0 && Boolean(menu.path)

  return {
    label: menu.name,
    icon: normalizeMenuIcon(menu.icon),
    to: clickable ? menu.path || undefined : undefined,
    exact: clickable,
    children: children.length > 0 ? children : undefined,
    onSelect: clickable ? closeSidebar : undefined
  }
}

const menuItems = computed<NavigationMenuItem[]>(() => {
  return profile.value?.menus.map(toNavigationItem) ?? []
})

onMounted(async () => {
  smallScreenMedia = window.matchMedia('(max-width: 1023px)')
  syncSmallScreen(smallScreenMedia.matches)
  smallScreenMedia.addEventListener('change', handleSmallScreenChange)

  try {
    await loadProfile()
  } catch {
    return
  }

  const cookie = useCookie('cookie-consent')
  if (cookie.value === 'accepted') {
    return
  }

  toast.add({
    title: 'We use first-party cookies to enhance your experience on our website.',
    duration: 0,
    close: false,
    actions: [{
      label: 'Accept',
      color: 'neutral',
      variant: 'outline',
      onClick: () => {
        cookie.value = 'accepted'
      }
    }, {
      label: 'Opt out',
      color: 'neutral',
      variant: 'ghost'
    }]
  })
})

onBeforeUnmount(() => {
  smallScreenMedia?.removeEventListener('change', handleSmallScreenChange)
})
</script>

<template>
  <!-- 整体后台布局容器：左侧菜单 + 右侧主工作区 -->
  <UDashboardGroup unit="rem">
    <!-- 左侧功能菜单：根据 RBAC 菜单树渲染，可折叠、可拖拽宽度 -->
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      v-model:collapsed="sidebarCollapsed"
      collapsible
      resizable
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header>
        <UIcon name="i-tabler:brand-nuxt" size="2em" class="text-primary" />
        <span v-if="!sidebarCollapsed" class="text-primary">Nuxt Admin</span>
      </template>

      <template #default="{ collapsed }">
        <div v-if="menuLoading" class="flex items-center gap-2 px-2 py-1.5 text-sm text-muted">
          <UIcon name="i-lucide-loader-circle" class="animate-spin" />
          <span v-if="!collapsed">Loading</span>
        </div>

        <UNavigationMenu
          v-else-if="menuItems.length > 0"
          :collapsed="collapsed"
          :items="menuItems"
          orientation="vertical"
          tooltip
          popover
        />

        <div v-else class="px-2 py-1.5 text-sm text-muted">
          <span v-if="!collapsed">No menus</span>
          <UIcon v-else name="i-lucide-circle-off" />
        </div>
      </template>
    </UDashboardSidebar>

    <!-- 右侧主区域：顶部导航 + 页签栏 + 页面内容 -->
    <UDashboardPanel id="home" :ui="{ body: 'p-0 sm:p-0 gap-0 sm:gap-0' }">
      <template #header>
        <!-- 顶部第一栏：面包屑、侧栏折叠按钮和右侧工具区 -->
        <AppBreadcrumb :collapsed="sidebarToggleCollapsed" @toggle-sidebar="toggleSidebar">
          <template #right>
            <BaseSearch />
            <BaseSwitchLocal />
            <BaseThemePick />
            <UserProfile />
          </template>
        </AppBreadcrumb>
        <!-- 顶部第二栏：多标签页导航 -->
        <AppTabsBar />
      </template>

      <template #body>
        <!-- 页面内容出口：路由页面在这里渲染 -->
        <div :key="refreshKey" class="flex-1 min-h-0">
          <slot />
        </div>
      </template>

      <template #footer>
        <!-- 底部辅助信息区 -->
        <div class="text-center">
          PowerBy nuxt
        </div>
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
