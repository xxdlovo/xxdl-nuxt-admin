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
    path: '/',
    // 落地页与后台共用语言偏好，并在客户端重启后保留一年。
    maxAge: 60 * 60 * 24 * 365
  })

  // i18n 模块优先从该 Cookie 恢复语言；仅在首次访问没有 Cookie 时写入当前默认值。
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
