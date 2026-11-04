import { TRPCError } from '@trpc/server'

/** Nitro 对 server/assets 目录提供的只读挂载名称，不能使用默认 storage。 */
const SERVER_STORAGE = 'assets:server'
/** 资源默认根目录；传入的自定义路径也必须位于此目录内。 */
const DEFAULT_RESOURCE_PATH = 'server/storage'
const RESOURCE_ROOT = 'storage'
const MAX_PREVIEW_LENGTH = 10_000

type CacheEnvelope<T> = {
  value: T
  expiresAt: number
}

export interface RememberCacheOptions {
  /** 缓存有效期（秒）；必须是正数。 */
  ttlSeconds: number
}

/** 同一进程内的请求合并表，避免同一 key 的并发 miss 重复查询数据库。 */
const pendingCacheLoads = new Map<string, Promise<unknown>>()

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

  private cacheKey(key: string) {
    const normalized = normalizePath(key)
    return normalized.startsWith('cache:') ? normalized : `cache:${normalized}`
  }

  /**
   * 从 memory 缓存读取 envelope。
   * 缓存异常按 miss 处理，业务会继续走 loader，不让缓存故障影响主流程。
   */
  async getCache<T>(key: string): Promise<T | null> {
    const storage = this.memory()
    const cacheKey = this.cacheKey(key)
    try {
      const envelope = await storage.getItem<CacheEnvelope<T>>(cacheKey)
      if (!envelope || typeof envelope !== 'object' || typeof envelope.expiresAt !== 'number') return null
      if (envelope.expiresAt <= Date.now()) {
        await this.removeCache(cacheKey)
        return null
      }
      return envelope.value
    } catch {
      return null
    }
  }

  /** 写入带过期时间的 JSON envelope，不依赖底层 driver 的 TTL 实现。 */
  async setCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) return
    try {
      await this.memory().setItem(this.cacheKey(key), {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000
      } satisfies CacheEnvelope<T>)
    } catch {
      // 缓存写入失败只影响命中率，不能阻断数据库写入或读取。
    }
  }

  /** 删除单个缓存 key。 */
  async removeCache(key: string): Promise<void> {
    try {
      await this.memory().removeItem(this.cacheKey(key))
    } catch {
      // memory driver 删除失败无需向业务抛错，下一次读取会自动回源。
    }
  }

  /** 删除指定前缀下的所有缓存，前缀会自动归一化到 cache 命名空间。 */
  async clearCache(prefix: string): Promise<void> {
    try {
      const storage = this.memory()
      // clearCache 接收的是逻辑前缀（例如 `dict:`），允许末尾冒号；
      // 不能复用完整 key 的严格校验，否则空的尾段会被误判为非法路径。
      const normalizedPrefix = prefix.trim().replace(/\\/g, '/')
      if (!normalizedPrefix || normalizedPrefix.startsWith('/') || /^[A-Za-z]:\//.test(normalizedPrefix)) return
      const parts = normalizedPrefix.split(/[/:]/).filter(Boolean)
      if (parts.some(part => part === '.' || part === '..')) return
      const base = normalizedPrefix.startsWith('cache:')
        ? normalizedPrefix.replace(/\//g, ':')
        : `cache:${normalizedPrefix.replace(/\//g, ':')}`
      const keys = await storage.getKeys(base)
      await Promise.all(keys.map(key => storage.removeItem(key)))
    } catch {
      // 清理失败由 TTL 兜底，避免管理写操作因缓存问题失败。
    }
  }

  /**
   * 缓存优先读取；miss 时执行 loader 并回填。
   * pendingCacheLoads 使用完整 cache key，保证不同服务实例仍能合并同一进程内请求。
   */
  async rememberCache<T>(key: string, loader: () => Promise<T> | T, options: RememberCacheOptions): Promise<T> {
    const cacheKey = this.cacheKey(key)
    const cached = await this.getCache<T>(cacheKey)
    if (cached !== null) return cached

    const pending = pendingCacheLoads.get(cacheKey) as Promise<T> | undefined
    if (pending) return pending

    const request = (async () => {
      const value = await loader()
      await this.setCache(cacheKey, value, options.ttlSeconds)
      return value
    })()
    pendingCacheLoads.set(cacheKey, request)
    try {
      return await request
    } finally {
      pendingCacheLoads.delete(cacheKey)
    }
  }

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
