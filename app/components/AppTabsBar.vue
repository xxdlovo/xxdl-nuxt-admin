<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { RbacMenu } from '#shared/auth'
import type { AppTab } from '~/stores/tabs'

const route = useRoute()
const router = useRouter()
const { profile } = useRbacProfile()
const tabsStore = useTabsStore()
const { tabs, activePath } = storeToRefs(tabsStore)

type RouteMetaTab = {
  title?: string
  icon?: string
}

const routeMeta = computed(() => route.meta as RouteMetaTab)

function normalizeIcon(icon?: string | null) {
  return icon || 'i-lucide-circle'
}

function findMenuByPath(menus: RbacMenu[], path: string): RbacMenu | null {
  for (const menu of menus) {
    if (menu.path === path) {
      return menu
    }

    const child = findMenuByPath(menu.children, path)
    if (child) {
      return child
    }
  }

  return null
}

function resolveTabTitle(path: string, meta: RouteMetaTab) {
  if (path === '/system/home') {
    return findMenuByPath(profile.value?.menus ?? [], path)?.name || meta.title || '首页'
  }

  return meta.title || path
}

function resolveTabIcon(path: string, meta: RouteMetaTab) {
  if (path === '/system/home') {
    return findMenuByPath(profile.value?.menus ?? [], path)?.icon || meta.icon || null
  }

  return meta.icon || null
}

function syncRouteTab() {
  const meta = routeMeta.value
  const path = route.path

  const homeMenu = findMenuByPath(profile.value?.menus ?? [], '/system/home')

  tabsStore.ensureHome({
    path: '/system/home',
    title: homeMenu?.name || '首页',
    icon: homeMenu?.icon || 'i-lucide-house'
  })

  tabsStore.upsertTab({
    path,
    title: resolveTabTitle(path, meta),
    icon: resolveTabIcon(path, meta),
    closable: path !== '/system/home'
  })
}

watch(
  () => [route.path, routeMeta.value.title, routeMeta.value.icon, profile.value?.menus] as const,
  syncRouteTab,
  { immediate: true }
)

function isActive(tab: AppTab) {
  return tab.path === activePath.value
}

async function activateTab(tab: AppTab) {
  tabsStore.activate(tab.path)

  if (route.path !== tab.path) {
    await router.push(tab.path)
  }
}

async function closeCurrentTab(tab: AppTab) {
  if (!tab.closable) {
    return
  }

  const shouldNavigate = route.path === tab.path
  tabsStore.closeTab(tab.path)

  if (shouldNavigate) {
    const nextTab = tabsStore.getLastTab()
    if (nextTab) {
      await activateTab(nextTab)
    }
  }
}

async function closeOthers(tab: AppTab) {
  tabsStore.closeOthers(tab.path)
  await activateTab(tab)
}

async function closeRight(tab: AppTab) {
  const currentPath = route.path
  tabsStore.closeRight(tab.path)

  if (!tabs.value.some(item => item.path === currentPath)) {
    const nextTab = tabsStore.getLastTab()
    if (nextTab) {
      await activateTab(nextTab)
    }
  }
}

function refreshCurrent() {
  tabsStore.refreshActive()
}

function menuItems(tab: AppTab) {
  return [[
    {
      label: '刷新当前',
      icon: 'i-lucide-refresh-cw',
      onSelect: refreshCurrent
    },
    {
      label: '关闭当前',
      icon: 'i-lucide-x',
      disabled: !tab.closable,
      onSelect: () => closeCurrentTab(tab)
    },
    {
      label: '关闭其他',
      icon: 'i-lucide-copy-x',
      onSelect: () => closeOthers(tab)
    },
    {
      label: '关闭右侧',
      icon: 'i-lucide-panel-right-close',
      onSelect: () => closeRight(tab)
    }
  ]]
}
</script>

<template>
  <div class="flex h-10 items-center border-b border-gray-200 bg-white px-2 dark:border-gray-800 dark:bg-gray-950">
    <div class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overflow-y-hidden">
      <UContextMenu
        v-for="tab in tabs"
        :key="tab.path"
        :items="menuItems(tab)"
      >
        <div
          role="button"
          tabindex="0"
          class="group flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/30"
          :class="isActive(tab)
            ? 'bg-primary/10 text-primary'
            : 'text-muted hover:bg-gray-100 hover:text-default dark:hover:bg-gray-800'"
          @click="activateTab(tab)"
          @keydown.enter.prevent="activateTab(tab)"
          @keydown.space.prevent="activateTab(tab)"
        >
          <UIcon
            v-if="tab.icon"
            :name="tab.icon"
            class="size-4 shrink-0"
            :class="isActive(tab) ? 'text-primary' : 'text-muted group-hover:text-default'"
          />
          <span class="max-w-40 truncate">{{ tab.title }}</span>
          <UButton
            v-if="tab.closable"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            square
            class="size-5 shrink-0 opacity-60 transition-opacity hover:opacity-100"
            @click.stop="closeCurrentTab(tab)"
          />
        </div>
      </UContextMenu>
    </div>
  </div>
</template>
