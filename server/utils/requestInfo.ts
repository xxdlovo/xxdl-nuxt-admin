import type { H3Event } from 'h3'
import { getHeader, getMethod, getRequestIP, getRequestURL } from 'h3'

/**
 * 无法从请求中解析到明确值时的兜底文案。
 */
const UNKNOWN = 'unknown'

/**
 * 截断即将写入日志表的字符串，避免请求头异常过长导致字段溢出。
 */
function truncate(value: string | null | undefined, maxLength: number) {
  if (!value) {
    return undefined
  }

  return value.length > maxLength ? value.slice(0, maxLength) : value
}

/**
 * 从 User-Agent 中粗略识别浏览器。
 * 这里只服务于日志筛选和展示，不作为严格的设备指纹。
 */
function parseBrowser(userAgent: string) {
  if (/Edg\//i.test(userAgent)) return 'Edge'
  if (/Chrome\//i.test(userAgent)) return 'Chrome'
  if (/Firefox\//i.test(userAgent)) return 'Firefox'
  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return 'Safari'
  if (/MSIE|Trident/i.test(userAgent)) return 'IE'
  return undefined
}

/**
 * 从 User-Agent 中粗略识别操作系统。
 * 这里只记录常见系统类型，无法识别时留空。
 */
function parseOs(userAgent: string) {
  if (/Windows NT/i.test(userAgent)) return 'Windows'
  if (/Mac OS X/i.test(userAgent)) return 'macOS'
  if (/Android/i.test(userAgent)) return 'Android'
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS'
  if (/Linux/i.test(userAgent)) return 'Linux'
  return undefined
}

/**
 * 提取一次请求的日志元信息。
 *
 * IP 获取顺序：
 * 1. x-forwarded-for 的第一个地址
 * 2. x-real-ip
 * 3. h3 getRequestIP
 *
 * traceId 优先使用网关或前端传入的 x-request-id，缺失时生成新的 UUID，
 * 便于后续把系统日志、登录日志和应用错误串联起来排查。
 */
export function getRequestInfo(event: H3Event) {
  const userAgent = getHeader(event, 'user-agent') ?? ''
  const forwardedIp = getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = getHeader(event, 'x-real-ip')?.trim()
  const ip = forwardedIp || realIp || getRequestIP(event) || UNKNOWN
  const traceId = getHeader(event, 'x-request-id') || crypto.randomUUID()
  const requestUrl = getRequestURL(event)

  return {
    ip: truncate(ip, 50) ?? UNKNOWN,
    userAgent: truncate(userAgent, 500),
    browser: truncate(parseBrowser(userAgent), 50),
    os: truncate(parseOs(userAgent), 50),
    requestMethod: truncate(getMethod(event), 20),
    requestPath: truncate(requestUrl.pathname, 255),
    traceId: truncate(traceId, 64)
  }
}
