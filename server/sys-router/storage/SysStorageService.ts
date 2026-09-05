import { TRPCError } from '@trpc/server'

/** Nitro 对 server 目录提供的只读挂载名称。 */
const SERVER_STORAGE = 'src'
/** 资源默认根目录；传入的自定义路径也必须位于此目录内。 */
const DEFAULT_RESOURCE_PATH = 'server/storage'
const RESOURCE_ROOT = 'storage'
const MAX_PREVIEW_LENGTH = 10_000

type Bucket = 'memory' | 'assets'
type Entry = { key: string; valueType: string; size: number; updatedAt: string | null; previewable: boolean }

function badKey(message = 'Invalid storage key'): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message })
}

/** 统一路径格式并拒绝绝对路径、空段和目录穿越。 */
function normalizePath(value: string) {
  const input = value.trim().replace(/\\/g, '/')
  if (!input || input.startsWith('/') || /^[A-Za-z]:\//.test(input)) badKey()
  // 冒号是 Unstorage 的层级分隔符，不能只校验斜杠路径，否则
  // `foo:..:bar` 仍可能绕过目录段校验。
  const parts = input.split(/[/:]/)
  if (parts.some(part => !part || part === '.' || part === '..')) badKey()
  return parts.join(':')
}

/** 将 server/storage 或 storage 子目录转换为 server 挂载下的 key。 */
function resolveResourceBase(resourcePath?: string) {
  const normalized = normalizePath(resourcePath || DEFAULT_RESOURCE_PATH)
  const relative = normalized.startsWith('server:') ? normalized.slice('server:'.length) : normalized
  if (relative !== RESOURCE_ROOT && !relative.startsWith(`${RESOURCE_ROOT}:`)) badKey('Resource path must be inside server/storage')
  return relative
}

function normalizeMemoryKey(key: string) {
  // memory 桶本身已经是独立命名空间，不需要限制为 server/storage 前缀；
  // 这里只做通用 key 安全校验，允许业务使用 user:1、cache:token 等 key。
  return normalizePath(key)
}

/** 把资源前缀转换成相对当前资源根的 key，供列表过滤使用。 */
function relativeResourceKey(value: string, resourcePath?: string) {
  const base = resolveResourceBase(resourcePath)
  const normalized = normalizePath(value)
  const relative = normalized.startsWith('server:') ? normalized.slice('server:'.length) : normalized
  if (relative === base) return ''
  if (relative.startsWith(`${base}:`)) return relative.slice(base.length + 1)
  if (relative === RESOURCE_ROOT || relative.startsWith(`${RESOURCE_ROOT}:`)) badKey('Storage key is outside the selected resource path')
  return relative
}

function valueType(value: unknown) {
  if (value === null) return 'null'
  if (value instanceof Uint8Array || value instanceof ArrayBuffer || Buffer.isBuffer(value)) return 'binary'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function sizeOf(value: unknown) {
  if (value instanceof Uint8Array || value instanceof ArrayBuffer || Buffer.isBuffer(value)) return value.byteLength
  if (typeof value === 'string') return Buffer.byteLength(value, 'utf8')
  try { return Buffer.byteLength(JSON.stringify(value), 'utf8') } catch { return 0 }
}

function updatedAt(meta: Record<string, unknown> | null | undefined) {
  if (!meta?.mtime) return null
  const date = meta.mtime instanceof Date ? meta.mtime : new Date(String(meta.mtime))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** 文本尝试按 JSON 格式化，所有预览均限制长度。 */
function preview(value: unknown) {
  if (valueType(value) === 'binary') return null
  if (typeof value === 'string') {
    try { return JSON.stringify(JSON.parse(value), null, 2).slice(0, MAX_PREVIEW_LENGTH) } catch { return value.slice(0, MAX_PREVIEW_LENGTH) }
  }
  try { return JSON.stringify(value, null, 2).slice(0, MAX_PREVIEW_LENGTH) } catch { return String(value).slice(0, MAX_PREVIEW_LENGTH) }
}

/** 存储管理服务，集中承载路径安全、分页、只读资源和内存删除逻辑。 */
export class SysStorageService {
  private memory() { return useStorage('memory') }
  private resources() { return useStorage(SERVER_STORAGE) }
  private storage(bucket: Bucket): ReturnType<typeof useStorage> { return bucket === 'memory' ? this.memory() : this.resources() }

  private fullKey(bucket: Bucket, key: string, resourcePath?: string) {
    if (bucket === 'memory') return normalizeMemoryKey(key)
    const base = resolveResourceBase(resourcePath)
    const normalized = normalizePath(key)
    // 允许 readString/readJson 直接接收 server/storage/xxx 这种完整相对路径；
    // 传入 storage/xxx 时也只允许它落在本次指定的资源根目录下。
    const relative = normalized.startsWith('server:') ? normalized.slice('server:'.length) : normalized
    if (relative === base || relative.startsWith(`${base}:`)) return relative
    if (relative === RESOURCE_ROOT || relative.startsWith(`${RESOURCE_ROOT}:`)) badKey('Storage key is outside the selected resource path')
    return `${base}:${relative}`
  }

  /** 列表使用限定根路径的 getKeys，绝不枚举 server 目录其它内容。 */
  async list(input: { bucket: Bucket; prefix?: string; resourcePath?: string; page: number; pageSize: number }) {
    const storage = this.storage(input.bucket)
    const base = input.bucket === 'assets' ? resolveResourceBase(input.resourcePath) : input.prefix ? normalizeMemoryKey(input.prefix) : ''
    const prefix = input.prefix
      ? input.bucket === 'assets' ? relativeResourceKey(input.prefix, input.resourcePath) : normalizeMemoryKey(input.prefix)
      : ''
    const keys: string[] = await storage.getKeys(base)
    const normalizedBase = base.replace(/\//g, ':')
    const allKeys: string[] = keys.map((key: string) => key.replace(/\\/g, ':').replace(/\//g, ':'))
      .filter((key: string) => !key.includes(':$') && key !== '.gitkeep')
      .map((key: string) => input.bucket === 'assets' && key.startsWith(`${normalizedBase}:`) ? key.slice(normalizedBase.length + 1) : key)
      .filter((key: string) => !prefix || key.startsWith(prefix))
      .sort((a: string, b: string) => a.localeCompare(b))
    const total = allKeys.length
    const start = (input.page - 1) * input.pageSize
    const list = await Promise.all(allKeys.slice(start, start + input.pageSize).map((key: string) => this.entry(input.bucket, key, input.resourcePath)))
    return { list, page: input.page, pageSize: input.pageSize, total }
  }

  private async entry(bucket: Bucket, key: string, resourcePath?: string): Promise<Entry> {
    const storage = this.storage(bucket)
    const fullKey = this.fullKey(bucket, key, resourcePath)
    const [value, meta] = await Promise.all([storage.getItem(fullKey), storage.getMeta(fullKey)])
    const type = valueType(value)
    return { key, valueType: type, size: Number(meta?.size) || sizeOf(value), updatedAt: updatedAt(meta), previewable: type !== 'binary' }
  }

  /** 获取详情和安全的文本/JSON 预览。 */
  async get(input: { bucket: Bucket; key: string; resourcePath?: string }) {
    const storage = this.storage(input.bucket)
    const fullKey = this.fullKey(input.bucket, input.key, input.resourcePath)
    const [value, meta, exists] = await Promise.all([storage.getItem(fullKey), storage.getMeta(fullKey), storage.hasItem(fullKey)])
    if (!exists) throw new TRPCError({ code: 'NOT_FOUND', message: 'Storage key not found' })
    const type = valueType(value)
    return { key: input.key, valueType: type, size: Number(meta?.size) || sizeOf(value), updatedAt: updatedAt(meta), previewable: type !== 'binary', preview: preview(value), mimeType: typeof meta?.type === 'string' ? meta.type : null }
  }

  /** 读取 server/storage 下资源为 UTF-8 字符串。 */
  async readString(relativePath: string, resourcePath = DEFAULT_RESOURCE_PATH) {
    const value = await this.resources().getItem(this.fullKey('assets', relativePath, resourcePath))
    if (value === null || value === undefined) return null
    return valueType(value) === 'binary' ? Buffer.from(value as Uint8Array).toString('utf8') : String(value)
  }

  /** 读取并解析 JSON；格式错误显式返回异常，避免业务继续使用错误配置。 */
  async readJson<T = unknown>(relativePath: string, resourcePath = DEFAULT_RESOURCE_PATH): Promise<T | null> {
    const text = await this.readString(relativePath, resourcePath)
    if (text === null) return null
    try { return JSON.parse(text) as T } catch { throw new TRPCError({ code: 'BAD_REQUEST', message: 'Storage value is not valid JSON' }) }
  }

  /** 读取原始二进制，供下载、哈希或 MIME 处理扩展使用。 */
  async readBuffer(relativePath: string, resourcePath = DEFAULT_RESOURCE_PATH) {
    const value = await this.resources().getItemRaw(this.fullKey('assets', relativePath, resourcePath))
    if (value === null || value === undefined) return null
    return Buffer.isBuffer(value) ? value : Buffer.from(value as Uint8Array)
  }

  /** 资源桶只读，删除接口仅操作显式 memory 命名空间。 */
  async removeMemory(key: string) {
    await this.memory().removeItem(normalizeMemoryKey(key))
    return true
  }
}

export const sysStorageService = () => new SysStorageService()
