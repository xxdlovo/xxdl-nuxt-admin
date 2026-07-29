import { defineStore } from 'pinia'
import { localStoragePersist } from './persistedStorage'

export type AppTab = {
  path: string
  title: string
  icon?: string | null
  closable: boolean
}

const HOME_PATH = '/system/home'

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<AppTab[]>([])
  const activePath = ref('')
  const refreshKey = ref(0)
  const manuallyClosedPaths = ref<Set<string>>(new Set())

  const activeTab = computed(() => tabs.value.find(tab => tab.path === activePath.value) ?? null)

  function ensureHome(tab: Omit<AppTab, 'closable'>) {
    const existing = tabs.value.find(item => item.path === HOME_PATH)

    if (existing) {
      existing.title = tab.title
      existing.icon = tab.icon
      existing.closable = false
      return existing
    }

    const homeTab: AppTab = {
      path: HOME_PATH,
      title: tab.title,
      icon: tab.icon,
      closable: false
    }

    tabs.value.unshift(homeTab)
    return homeTab
  }

  function upsertTab(tab: Omit<AppTab, 'closable'> & { closable?: boolean }) {
    manuallyClosedPaths.value.delete(tab.path)

    const nextTab: AppTab = {
      ...tab,
      closable: tab.path !== HOME_PATH && (tab.closable ?? true)
    }

    const existing = tabs.value.find(item => item.path === nextTab.path)

    if (existing) {
      existing.title = nextTab.title
      existing.icon = nextTab.icon
      existing.closable = nextTab.closable
    } else {
      tabs.value.push(nextTab)
    }

    activePath.value = nextTab.path
  }

  function activate(path: string) {
    activePath.value = path
  }

  function closeTab(path: string) {
    const target = tabs.value.find(tab => tab.path === path)

    if (!target?.closable) {
      return
    }

    manuallyClosedPaths.value.add(path)
    tabs.value = tabs.value.filter(tab => tab.path !== path)
  }

  function closeOthers(path: string) {
    if (!tabs.value.some(tab => tab.path === path)) {
      return
    }

    tabs.value = tabs.value.filter(tab => tab.path === path || !tab.closable)
    activePath.value = path
  }

  function closeRight(path: string) {
    const targetIndex = tabs.value.findIndex(tab => tab.path === path)

    if (targetIndex < 0) {
      return
    }

    tabs.value = tabs.value.filter((tab, index) => index <= targetIndex || !tab.closable)
  }

  function closeAll() {
    tabs.value = tabs.value.filter(tab => !tab.closable)
  }

  function getAdjacentTab(path: string) {
    const targetIndex = tabs.value.findIndex(tab => tab.path === path)

    if (targetIndex < 0) {
      return getLastTab()
    }

    return tabs.value[targetIndex - 1] ?? tabs.value[targetIndex + 1] ?? tabs.value.find(tab => !tab.closable) ?? null
  }

  function getLastTab() {
    return tabs.value[tabs.value.length - 1] ?? tabs.value[0] ?? null
  }

  function refreshActive() {
    refreshKey.value += 1
  }

  function isManuallyClosed(path: string) {
    return manuallyClosedPaths.value.has(path)
  }

  function clearManuallyClosedPaths() {
    manuallyClosedPaths.value.clear()
  }

  return {
    tabs,
    activePath,
    activeTab,
    refreshKey,
    ensureHome,
    upsertTab,
    activate,
    closeTab,
    closeOthers,
    closeRight,
    closeAll,
    getAdjacentTab,
    getLastTab,
    refreshActive,
    isManuallyClosed,
    clearManuallyClosedPaths
  }
}, {
  persist: {
    key: 'tabs',
    storage: localStoragePersist,
    pick: ['tabs', 'activePath']
  }
})
