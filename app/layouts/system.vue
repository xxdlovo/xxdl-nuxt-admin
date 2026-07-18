<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { NavigationMenuItem } from '@nuxt/ui'
import type { RbacMenu } from '#shared/auth'
import { useTabsStore } from '~/stores/tabs'

const toast = useToast()
const { profile, loading: menuLoading, loadProfile } = useRbacProfile()
const tabsStore = useTabsStore()
const { refreshKey } = storeToRefs(tabsStore)

const open = ref(false)
const sidebarCollapsed = ref(false)

function closeSidebar() {
  open.value = false
}

function normalizeMenuIcon(icon?: string | null) {
  return icon || 'i-lucide-circle'
}

function toNavigationItem(menu: RbacMenu): NavigationMenuItem {
  const children = menu.children.map(toNavigationItem)

  return {
    label: menu.name,
    icon: normalizeMenuIcon(menu.icon),
    to: menu.path || undefined,
    exact: Boolean(menu.path),
    children: children.length > 0 ? children : undefined,
    onSelect: closeSidebar
  }
}

const menuItems = computed<NavigationMenuItem[]>(() => {
  return profile.value?.menus.map(toNavigationItem) ?? []
})

onMounted(async () => {
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
</script>

<template>
  <UDashboardGroup unit="rem">
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

    <UDashboardPanel id="home" :ui="{ body: 'p-0 sm:p-0 gap-0 sm:gap-0' }">
      <template #header>
        <AppBreadcrumb :collapsed="sidebarCollapsed" @toggle-sidebar="sidebarCollapsed = !sidebarCollapsed">
          <template #right>
            <BaseSearch />
            <BaseSwitchLocal />
            <BaseThemePick />
            <UserProfile />
          </template>
        </AppBreadcrumb>
        <AppTabsBar />
      </template>

      <template #body>
        <div :key="refreshKey" class="flex-1 min-h-0">
          <slot />
        </div>
      </template>

      <template #footer>
        <div class="text-center">
          PowerBy nuxt
        </div>
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
