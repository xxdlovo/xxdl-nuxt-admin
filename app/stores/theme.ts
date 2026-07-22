import { defineStore } from 'pinia'
import { layoutModes, type LayoutMode } from '#shared/layout'

const layoutModeStorageKey = 'theme:layoutMode'
const layoutSettingsStorageKey = 'theme:layoutSettings'

export type TabMode = 'chrome' | 'button'
export type ScrollMode = 'wrapper' | 'content'
export type PageAnimateMode = 'fade-slide' | 'fade' | 'fade-bottom' | 'fade-scale' | 'zoom-fade' | 'zoom-out' | 'none'
export type WatermarkTimeFormat = 'YYYY-MM-DD HH:mm' | 'YYYY/MM/DD HH:mm' | 'YYYY-MM-DD HH:mm:ss'
const pageAnimateModes: PageAnimateMode[] = ['fade-slide', 'fade', 'fade-bottom', 'fade-scale', 'zoom-fade', 'zoom-out', 'none']
const watermarkTimeFormats: WatermarkTimeFormat[] = ['YYYY-MM-DD HH:mm', 'YYYY/MM/DD HH:mm', 'YYYY-MM-DD HH:mm:ss']

const defaultHeaderSettings = {
  height: 56,
  breadcrumbVisible: true,
  breadcrumbIconVisible: true
}

const defaultTabSettings = {
  visible: true,
  height: 40,
  mode: 'chrome' as TabMode,
  middleClickClose: false
}

const defaultSiderSettings = {
  width: 220,
  collapsedWidth: 64,
  mixWidth: 90,
  mixCollapsedWidth: 64,
  mixChildMenuWidth: 200,
  autoSelectFirstMenu: false
}

const defaultFooterSettings = {
  visible: true,
  height: 48
}

const defaultContentSettings = {
  scrollMode: 'content' as ScrollMode,
  pageAnimate: true,
  pageAnimateMode: 'fade-slide' as PageAnimateMode
}

const defaultGeneralSettings = {
  localeVisible: true,
  globalSearchVisible: true,
  watermark: {
    visible: false,
    userNameVisible: false,
    currentTimeVisible: false,
    timeFormat: 'YYYY-MM-DD HH:mm' as WatermarkTimeFormat
  }
}

function normalizeLayoutMode(value?: string | null): LayoutMode {
  return layoutModes.includes(value as LayoutMode) ? value as LayoutMode : 'vertical'
}

function normalizeNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizePageAnimateMode(value: unknown) {
  return pageAnimateModes.includes(value as PageAnimateMode) ? value as PageAnimateMode : defaultContentSettings.pageAnimateMode
}

function normalizeWatermarkTimeFormat(value: unknown) {
  return watermarkTimeFormats.includes(value as WatermarkTimeFormat) ? value as WatermarkTimeFormat : defaultGeneralSettings.watermark.timeFormat
}

export const useThemeStore = defineStore('theme', () => {
  const layoutMode = ref<LayoutMode>('vertical')
  const siderCollapse = ref(false)
  const mixSiderFixed = ref(false)

  const header = reactive({ ...defaultHeaderSettings })

  const tab = reactive({ ...defaultTabSettings })

  const sider = reactive({ ...defaultSiderSettings })
  const footer = reactive({ ...defaultFooterSettings })
  const content = reactive({ ...defaultContentSettings })
  const general = reactive({
    localeVisible: defaultGeneralSettings.localeVisible,
    globalSearchVisible: defaultGeneralSettings.globalSearchVisible,
    watermark: { ...defaultGeneralSettings.watermark }
  })

  function setLayoutMode(mode: LayoutMode) {
    layoutMode.value = mode
    mixSiderFixed.value = false
  }

  function toggleSiderCollapse() {
    siderCollapse.value = !siderCollapse.value
  }

  function setSiderCollapse(value: boolean) {
    siderCollapse.value = value
  }

  function toggleMixSiderFixed() {
    mixSiderFixed.value = !mixSiderFixed.value
  }

  function resetLayoutSettings() {
    layoutMode.value = 'vertical'
    siderCollapse.value = false
    mixSiderFixed.value = false
    Object.assign(header, defaultHeaderSettings)
    Object.assign(tab, defaultTabSettings)
    Object.assign(sider, defaultSiderSettings)
    Object.assign(footer, defaultFooterSettings)
    Object.assign(content, defaultContentSettings)
    Object.assign(general, {
      localeVisible: defaultGeneralSettings.localeVisible,
      globalSearchVisible: defaultGeneralSettings.globalSearchVisible
    })
    Object.assign(general.watermark, defaultGeneralSettings.watermark)
  }

  function getLayoutSettingsSnapshot() {
    return {
      layoutMode: layoutMode.value,
      siderCollapse: siderCollapse.value,
      mixSiderFixed: mixSiderFixed.value,
      header: { ...header },
      tab: { ...tab },
      sider: { ...sider },
      footer: { ...footer },
      content: { ...content },
      general: {
        localeVisible: general.localeVisible,
        globalSearchVisible: general.globalSearchVisible,
        watermark: { ...general.watermark }
      }
    }
  }

  function loadLayoutSettings() {
    const saved = window.localStorage.getItem(layoutSettingsStorageKey)
    if (!saved) {
      return
    }

    try {
      const settings = JSON.parse(saved) as {
        siderCollapse?: boolean
        mixSiderFixed?: boolean
        header?: Partial<typeof defaultHeaderSettings>
        tab?: Partial<typeof defaultTabSettings>
        sider?: Partial<typeof defaultSiderSettings>
        footer?: Partial<typeof defaultFooterSettings>
        content?: Partial<typeof defaultContentSettings>
        general?: {
          localeVisible?: boolean
          globalSearchVisible?: boolean
          watermark?: Partial<typeof defaultGeneralSettings.watermark>
        }
      }

      if (typeof settings.siderCollapse === 'boolean') {
        siderCollapse.value = settings.siderCollapse
      }

      if (typeof settings.mixSiderFixed === 'boolean') {
        mixSiderFixed.value = settings.mixSiderFixed
      }

      if (settings.header) {
        header.height = normalizeNumber(settings.header.height, defaultHeaderSettings.height)
        header.breadcrumbVisible = settings.header.breadcrumbVisible ?? defaultHeaderSettings.breadcrumbVisible
        header.breadcrumbIconVisible = settings.header.breadcrumbIconVisible ?? defaultHeaderSettings.breadcrumbIconVisible
      }

      if (settings.tab) {
        tab.visible = settings.tab.visible ?? defaultTabSettings.visible
        tab.height = normalizeNumber(settings.tab.height, defaultTabSettings.height)
        tab.mode = settings.tab.mode === 'button' ? 'button' : 'chrome'
        tab.middleClickClose = settings.tab.middleClickClose ?? defaultTabSettings.middleClickClose
      }

      if (settings.sider) {
        sider.width = normalizeNumber(settings.sider.width, defaultSiderSettings.width)
        sider.collapsedWidth = normalizeNumber(settings.sider.collapsedWidth, defaultSiderSettings.collapsedWidth)
        sider.mixWidth = normalizeNumber(settings.sider.mixWidth, defaultSiderSettings.mixWidth)
        sider.mixCollapsedWidth = normalizeNumber(settings.sider.mixCollapsedWidth, defaultSiderSettings.mixCollapsedWidth)
        sider.mixChildMenuWidth = normalizeNumber(settings.sider.mixChildMenuWidth, defaultSiderSettings.mixChildMenuWidth)
        sider.autoSelectFirstMenu = settings.sider.autoSelectFirstMenu ?? defaultSiderSettings.autoSelectFirstMenu
      }

      if (settings.footer) {
        footer.visible = settings.footer.visible ?? defaultFooterSettings.visible
        footer.height = normalizeNumber(settings.footer.height, defaultFooterSettings.height)
      }

      if (settings.content) {
        content.scrollMode = settings.content.scrollMode === 'wrapper' ? 'wrapper' : 'content'
        content.pageAnimate = settings.content.pageAnimate ?? defaultContentSettings.pageAnimate
        content.pageAnimateMode = normalizePageAnimateMode(settings.content.pageAnimateMode)
      }

      if (settings.general) {
        general.localeVisible = settings.general.localeVisible ?? defaultGeneralSettings.localeVisible
        general.globalSearchVisible = settings.general.globalSearchVisible ?? defaultGeneralSettings.globalSearchVisible
        if (settings.general.watermark) {
          general.watermark.visible = settings.general.watermark.visible ?? defaultGeneralSettings.watermark.visible
          general.watermark.userNameVisible = settings.general.watermark.userNameVisible ?? defaultGeneralSettings.watermark.userNameVisible
          general.watermark.currentTimeVisible = settings.general.watermark.currentTimeVisible ?? defaultGeneralSettings.watermark.currentTimeVisible
          general.watermark.timeFormat = normalizeWatermarkTimeFormat(settings.general.watermark.timeFormat)
        }
      }
    } catch {
      window.localStorage.removeItem(layoutSettingsStorageKey)
    }
  }

  if (import.meta.client) {
    layoutMode.value = normalizeLayoutMode(window.localStorage.getItem(layoutModeStorageKey))
    loadLayoutSettings()

    watch(layoutMode, value => {
      window.localStorage.setItem(layoutModeStorageKey, value)
    })

    watch(
      () => getLayoutSettingsSnapshot(),
      value => {
        window.localStorage.setItem(layoutSettingsStorageKey, JSON.stringify(value))
      },
      { deep: true }
    )
  }

  return {
    layoutMode,
    siderCollapse,
    mixSiderFixed,
    header,
    tab,
    sider,
    footer,
    content,
    general,
    setLayoutMode,
    toggleSiderCollapse,
    setSiderCollapse,
    toggleMixSiderFixed,
    resetLayoutSettings,
    getLayoutSettingsSnapshot
  }
})
