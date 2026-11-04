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
 * 替换 `{name}` 占位符。
 *
 * 为什么需要：业务错误经常把参数塞进 `AppError` 的 message（例如优惠码门槛金额
 * `module.system.member.couponMinAmount` 的「最低 {message} 元」）。服务端翻译如果
 * 不做插值，用户看到的就是字面上的 `{message}`。
 * 未提供的参数保持原样，便于发现漏传。
 */
function interpolate(text: string, params?: Record<string, unknown>): string {
  if (!params) {
    return text
  }

  return text.replace(/\{(\w+)\}/g, (matched, name: string) => {
    const value = params[name]

    return value === undefined || value === null ? matched : String(value)
  })
}

/**
 * 取文案：key 命中的值不是字符串（例如指向一个对象）时返回 key 本身，
 * 由调用方决定兜底文案 —— 避免把对象当成 message 传给前端。
 */
function lookup(messages: Record<string, any>, key: string, params?: Record<string, unknown>): string {
  if (!key) {
    return key
  }

  const translation = resolveNestedKey(messages, key)

  return typeof translation === 'string' ? interpolate(translation, params) : key
}

/**
 * 创建服务端翻译函数
 * 根据 H3Event 自动检测语言环境（优先从 i18n_locale cookie 读取）
 */
export function createServerT(event: H3Event) {
  const cookie = getCookie(event, 'i18n_locale')
  const locale = cookie || 'en'
  const messages = translations[locale] || en

  return (key: string, params?: Record<string, unknown>): string => lookup(messages, key, params)
}

/**
 * 根据语言代码直接获取翻译函数（无需 event）
 */
export function createLocaleT(locale: string = 'en') {
  const messages = translations[locale] || en

  return (key: string, params?: Record<string, unknown>): string => lookup(messages, key, params)
}
