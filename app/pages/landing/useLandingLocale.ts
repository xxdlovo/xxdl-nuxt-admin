import { landingContentEn } from './content/en'
import { landingContentZh } from './content/zh'
import type { LandingLocale } from '@/types/landing/content'

const contentByLocale = {
  en: landingContentEn,
  zh: landingContentZh
}

function normalizeLocale(locale: string): LandingLocale {
  return locale.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function useLandingLocale() {
  const { $getLocale, $getLocales, $switchLocale } = useI18n()
  const locale = useState<LandingLocale>('landing-locale', () => normalizeLocale($getLocale()))
  const localeCookie = useCookie<string>('i18n_locale', {
    sameSite: 'lax',
    path: '/'
  })

  locale.value = normalizeLocale($getLocale())
  localeCookie.value ||= locale.value

  const content = computed(() => contentByLocale[locale.value])
  const locales = computed(() => $getLocales().map(item => ({
    code: normalizeLocale(item.code),
    label: item.name as string
  })))

  function switchLocale(nextLocale: string) {
    const normalized = normalizeLocale(nextLocale)
    locale.value = normalized
    localeCookie.value = normalized
    $switchLocale(normalized)
  }

  return {
    content,
    locale,
    locales,
    switchLocale
  }
}
