import zh from '~~/app/locales/zh.json'
import en from '~~/app/locales/en.json'
import { H3Event } from 'h3'
const translations: Record<string, Record<string, any>> = { zh, en }

/**
 * 解析嵌套的 key，如 "form.userName.required" → "请输入用户名"
 */
function resolveNestedKey(obj: Record<string, any>, key: string): string | undefined {
  return key.split('.').reduce<string | undefined>((current, segment) => {
    if (current && typeof current === 'object' && segment in current) {
      return current[segment]
    }
    return undefined
  }, obj as any)
}

/**
 * 创建服务端翻译函数
 * 根据 H3Event 自动检测语言环境（优先从 i18n_locale cookie 读取）
 */
export function createServerT(event: H3Event) {
  const cookie = getCookie(event, 'i18n_locale')
  const locale = cookie || 'en'
  const messages = translations[locale] || en

  return (key: string): string => {
    if (!key) return key
    const translation = resolveNestedKey(messages, key)
    return translation ?? key
  }
}

/**
 * 根据语言代码直接获取翻译函数（无需 event）
 */
export function createLocaleT(locale: string = 'en') {
  const messages = translations[locale] || en
  return (key: string): string => {
    if (!key) return key
    const translation = resolveNestedKey(messages, key)
    return translation ?? key
  }
}
