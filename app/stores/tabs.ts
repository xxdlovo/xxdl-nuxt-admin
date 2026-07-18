import { defineStore } from 'pinia'

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

    tabs.value = tabs.value.filter(tab => tab.path !== path)
  }

  function closeOthers(path: string) {
    tabs.value = tabs.value.filter(tab => tab.path === path || !tab.closable)
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

  function getLastTab() {
    return tabs.value[tabs.value.length - 1] ?? tabs.value[0] ?? null
  }

  function refreshActive() {
    refreshKey.value += 1
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
    getLastTab,
    refreshActive
  }
})
