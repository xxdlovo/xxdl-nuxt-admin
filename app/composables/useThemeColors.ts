import {
  applyThemeColorStyles,
  resolveColorHex,
  themeColorKeys,
  type ThemeColorKey
} from '~/composables/themeColorUtils'

const themeColorStoragePrefix = 'nuxt-ui-theme-'
const legacyThemeColorStoragePrefix = 'nuxt-ui-'
const blackAsPrimaryStorageKey = 'nuxt-ui-black-as-primary'

export function useThemeColors() {
  const appConfig = useAppConfig()

  function getThemeColor(key: ThemeColorKey) {
    return resolveColorHex(appConfig.theme.colors?.[key] || appConfig.ui.colors[key])
  }

  function getThemeColors() {
    return Object.fromEntries(
      themeColorKeys.map(key => [key, getThemeColor(key)])
    ) as Record<ThemeColorKey, string>
  }

  function applyThemeColors() {
    applyThemeColorStyles(getThemeColors())
  }

  function setThemeColor(key: ThemeColorKey, value: string) {
    const resolved = resolveColorHex(value)
    appConfig.theme.colors ||= {}
    appConfig.theme.colors[key] = resolved
    applyThemeColors()

    if (import.meta.client) {
      window.localStorage.setItem(`${themeColorStoragePrefix}${key}`, resolved)
    }
  }

  function resetThemeColor(key: ThemeColorKey) {
    if (appConfig.theme.colors) {
      delete appConfig.theme.colors[key]
    }
    applyThemeColors()

    if (import.meta.client) {
      window.localStorage.removeItem(`${themeColorStoragePrefix}${key}`)
      window.localStorage.removeItem(`${legacyThemeColorStoragePrefix}${key}`)
    }
  }

  function resetThemeColors() {
    appConfig.theme.colors = {}
    applyThemeColors()

    if (import.meta.client) {
      for (const key of themeColorKeys) {
        window.localStorage.removeItem(`${themeColorStoragePrefix}${key}`)
        window.localStorage.removeItem(`${legacyThemeColorStoragePrefix}${key}`)
      }
    }
  }

  function setBlackAsPrimary(value: boolean) {
    appConfig.theme.blackAsPrimary = value
    if (import.meta.client) {
      window.localStorage.setItem(blackAsPrimaryStorageKey, String(value))
    }
  }

  function resetBlackAsPrimary() {
    appConfig.theme.blackAsPrimary = false
    if (import.meta.client) {
      window.localStorage.removeItem(blackAsPrimaryStorageKey)
    }
  }

  function initializeThemeColors() {
    if (!import.meta.client) {
      return
    }

    for (const key of themeColorKeys) {
      const savedValue = window.localStorage.getItem(`${themeColorStoragePrefix}${key}`)
        || window.localStorage.getItem(`${legacyThemeColorStoragePrefix}${key}`)
      if (savedValue) {
        appConfig.theme.colors ||= {}
        appConfig.theme.colors[key] = resolveColorHex(savedValue)
      }
    }

    const savedBlackAsPrimary = window.localStorage.getItem(blackAsPrimaryStorageKey)
    if (savedBlackAsPrimary !== null) {
      appConfig.theme.blackAsPrimary = savedBlackAsPrimary === 'true'
    }

    applyThemeColors()
  }

  return {
    applyThemeColors,
    getThemeColor,
    getThemeColors,
    initializeThemeColors,
    resetBlackAsPrimary,
    resetThemeColor,
    resetThemeColors,
    setBlackAsPrimary,
    setThemeColor
  }
}
