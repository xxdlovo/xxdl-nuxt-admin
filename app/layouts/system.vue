<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { RbacMenu } from '#shared/auth'

const route = useRoute()
const toast = useToast()
const { profile, loading: menuLoading, loadProfile } = useRbacProfile()

const open = ref(false)

function closeSidebar() {
  open.value = false
}

function normalizeMenuIcon(icon?: string | null) {
  return icon || 'i-lucide-circle'
}

/**
 * Convert backend RBAC menus into Nuxt UI navigation items.
 * This stays in the app layer because NavigationMenuItem belongs to the UI library.
 */
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

function flattenMenus(menus: RbacMenu[]): RbacMenu[] {
  return menus.flatMap(menu => [menu, ...flattenMenus(menu.children)])
}

const menuItems = computed<NavigationMenuItem[]>(() => {
  return profile.value?.menus.map(toNavigationItem) ?? []
})

const currentTitle = computed(() => {
  const currentMenu = flattenMenus(profile.value?.menus ?? [])
    .find(menu => menu.path === route.path)

  return currentMenu?.name ?? 'Nuxt Admin'
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
      collapsible
      resizable
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <UIcon name="i-tabler:brand-nuxt" size="2em" class="text-primary" />
        <span v-if="!collapsed" class="text-primary">Nuxt Admin</span>
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
        <UDashboardNavbar :ui="{ right: 'gap-3' }">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>

          <template #title>
            {{ currentTitle }}
          </template>

          <template #right>
            <BaseSearch />
            <BaseSwitchLocal />
            <BaseThemePick />
            <UserProfile />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div class="h-[40px] flex-shrink-0">
          {{ currentTitle }}
        </div>
        <div class="flex-1 min-h-0">
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
