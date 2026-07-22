<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { AppTab } from '~/stores/tabs'
import { resolveNavigationMeta } from '~/utils/navigation'

const route = useRoute()
const router = useRouter()
const { profile } = useRbacProfile()
const tabsStore = useTabsStore()
const themeStore = useThemeStore()
const { tabs, activePath } = storeToRefs(tabsStore)
const {$ts} = useI18n()
let lastSyncedPath = route.path
type RouteMetaTab = {
  title?: string
}

const routeMeta = computed(() => route.meta as RouteMetaTab)

function syncRouteTab() {
  const meta = routeMeta.value
  const path = route.path
  if (path !== lastSyncedPath) {
    tabsStore.clearManuallyClosedPaths()
    lastSyncedPath = path
  }

  const navMeta = resolveNavigationMeta(profile.value?.menus ?? [], path, meta, path)
  const homeMeta = resolveNavigationMeta(profile.value?.menus ?? [], '/system/home', { title: '首页' }, '首页')

  tabsStore.ensureHome({
    path: '/system/home',
    title: homeMeta.title,
    icon: homeMeta.icon
  })

  if (tabsStore.isManuallyClosed(path)) {
    return
  }

  tabsStore.upsertTab({
    path,
    title: navMeta.title,
    icon: navMeta.icon,
    closable: path !== '/system/home'
  })
}

watch(
  () => [route.path, routeMeta.value.title, profile.value?.menus] as const,
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

  const shouldNavigate = route.path === tab.path || activePath.value === tab.path
  const nextTab = shouldNavigate ? tabsStore.getAdjacentTab(tab.path) : null
  tabsStore.closeTab(tab.path)

  if (shouldNavigate && nextTab) {
    tabsStore.activate(nextTab.path)

    if (route.path !== nextTab.path) {
      await router.replace(nextTab.path)
    }
  }
}

async function closeOthers(tab: AppTab) {
  await activateTab(tab)
  await nextTick()
  tabsStore.closeOthers(tab.path)
}

async function closeRight(tab: AppTab) {
  const currentPath = route.path
  tabsStore.closeRight(tab.path)

  if (!tabs.value.some(item => item.path === currentPath)) {
    const nextTab = tabsStore.getLastTab()
    if (nextTab) {
      tabsStore.activate(nextTab.path)

      if (route.path !== nextTab.path) {
        await router.replace(nextTab.path)
      }
    }
  }
}

function refreshCurrent() {
  tabsStore.refreshActive()
}

function handleMiddleClick(tab: AppTab) {
  if (!themeStore.tab.middleClickClose || !tab.closable) {
    return
  }

  void closeCurrentTab(tab)
}

function menuItems(tab: AppTab) {
  return [[
    {
      label: $ts('dropdown.flush'),
      icon: 'i-lucide-refresh-cw',
      onSelect: refreshCurrent
    },
    {
      label: $ts('dropdown.closeCurrent'),
      icon: 'i-lucide-x',
      disabled: !tab.closable,
      onSelect: () => closeCurrentTab(tab)
    },
    {
      label: $ts('dropdown.closeOther'),
      icon: 'i-lucide-copy-x',
      onSelect: () => closeOthers(tab)
    },
    {
      label: $ts('dropdown.closeRight'),
      icon: 'i-lucide-panel-right-close',
      onSelect: () => closeRight(tab)
    }
  ]]
}
</script>

<template>
  <div
    class="flex items-center border-b border-default bg-default px-2"
    :style="{ height: `${themeStore.tab.height}px` }"
  >
    <div class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overflow-y-hidden">
      <UContextMenu
        v-for="tab in tabs"
        :key="tab.path"
        :items="menuItems(tab)"
      >
        <div
          role="button"
          tabindex="0"
          class="group flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/30"
          :class="isActive(tab)
            ? themeStore.tab.mode === 'button' ? 'bg-primary text-inverted' : 'bg-primary/10 text-primary'
            : themeStore.tab.mode === 'button' ? 'bg-elevated text-muted hover:text-default' : 'text-muted hover:bg-elevated hover:text-default'"
          @click="activateTab(tab)"
          @auxclick.middle.prevent="handleMiddleClick(tab)"
          @keydown.enter.prevent="activateTab(tab)"
          @keydown.space.prevent="activateTab(tab)"
        >
          <UIcon
            v-if="tab.icon"
            :name="tab.icon"
            class="size-4 shrink-0"
            :class="isActive(tab) && themeStore.tab.mode === 'button'
              ? 'text-inverted'
              : isActive(tab) ? 'text-primary' : 'text-muted group-hover:text-default'"
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
            @pointerdown.stop
            @mousedown.stop
            @mouseup.stop
            @click.stop.prevent="closeCurrentTab(tab)"
          />
        </div>
      </UContextMenu>
    </div>
  </div>
</template>
