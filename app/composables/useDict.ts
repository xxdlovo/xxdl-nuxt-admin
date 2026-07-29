import type { BadgeConfig } from '#shared/types/nuxtui'

interface SelectOption {
  value: string
  label: string
}

interface NumberSelectOption {
  value: number
  label: string
}

type BadgeColor = BadgeConfig['color']
const badgeColors = new Set<BadgeColor>(['primary', 'secondary', 'success', 'warning', 'error', 'info', 'neutral'])

export function useDictOptions(code: string, includeValues?: Array<string | number>) {
  const { $ts } = useI18n()
  const dictStore = useDictStore()
  const includeValueSet = computed(() => includeValues ? new Set(includeValues.map(String)) : null)

  void dictStore.loadDict(code)

  return computed<SelectOption[]>(() => {
    const items = dictStore.itemsByCode[code] ?? []

    return items
      .filter(item => item.value && (item.i18nKey || item.label) && (!includeValueSet.value || includeValueSet.value.has(String(item.value))))
      .map(item => {
        const labelKey = item.i18nKey || item.label

        return {
          value: item.value as string,
          label: $ts(labelKey as string)
        }
      })
  })
}

export function useDictNumberOptions(code: string, includeValues?: Array<string | number>) {
  const options = useDictOptions(code, includeValues)

  return computed<NumberSelectOption[]>(() =>
    options.value.map(option => ({
      value: Number(option.value),
      label: option.label
    }))
  )
}

export function useDictBadgeConfig(
  code: string,
  defaultColor: BadgeColor = 'neutral'
) {
  const dictStore = useDictStore()

  void dictStore.loadDict(code)

  return computed<Record<string, BadgeConfig>>(() => {
    const items = dictStore.itemsByCode[code] ?? []

    return items.reduce<Record<string, BadgeConfig>>((config, item) => {
      const i18nKey = item.i18nKey || item.label

      if (!item.value || !i18nKey) {
        return config
      }

      const value = item.value as string
      const color = badgeColors.has(item.listClass as BadgeColor) ? item.listClass as BadgeColor : defaultColor
      config[value] = {
        i18nKey: i18nKey as string,
        color
      }

      return config
    }, {})
  })
}
