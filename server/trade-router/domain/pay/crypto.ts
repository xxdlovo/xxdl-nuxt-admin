/**
 * 渠道密钥的字段级加解密。
 *
 * 只有 PayProviderField 上标记 secret: true 的字段会被加密，
 * 其余字段保持明文（便于排障与筛选），因此 sys_pay_channel.config 是混合结构：
 *   { "appid": "xxx", "gateway": "https://...", "secret": { v, alg, iv, tag, data } }
 *
 * 密钥来自环境变量 NUXT_PAY_CONFIG_KEY（32 字节，base64 或 64 位 hex）。
 * 缺 key 时保存密钥字段会直接报错，避免产生永远解不开的脏数据。
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { AppError } from '#server/utils/appError'
import type { PayProviderField } from './types'

export type SecretEnvelope = {
  v: 1
  alg: 'aes-256-gcm'
  iv: string
  tag: string
  data: string
}

const ALGORITHM = 'aes-256-gcm'
const ENVELOPE_VERSION = 1 as const
const MASK_PREFIX = '****'

export type PayConfigKeyReason = 'ok' | 'missing' | 'invalid'

/**
 * 读取主密钥原文。
 * 优先 runtimeConfig.payConfigKey（nuxt.config.ts 中声明占位、由 NUXT_PAY_CONFIG_KEY 运行时覆盖），
 * 兜底直接读 process.env，兼容脚本/定时任务等没有 Nitro 运行时的场景。
 */
function readRawKey(): string {
  let fromRuntimeConfig = ''

  try {
    const config = useRuntimeConfig() as unknown as Record<string, unknown>
    const value = config.payConfigKey

    if (typeof value === 'string') {
      fromRuntimeConfig = value.trim()
    }
  } catch {
    fromRuntimeConfig = ''
  }

  return fromRuntimeConfig || (process.env.NUXT_PAY_CONFIG_KEY ?? '').trim()
}

function decodeKey(raw: string): Buffer {
  return /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64')
}

/**
 * 供渠道配置页提示用：密钥是否可用，以及不可用的具体原因。
 * 区分 missing / invalid 很重要——否则「格式不对」会被误报成「没配置」。
 */
export function describePayConfigKey(): { ready: boolean; reason: PayConfigKeyReason } {
  const raw = readRawKey()

  if (!raw) {
    return { ready: false, reason: 'missing' }
  }

  return decodeKey(raw).length === 32
    ? { ready: true, reason: 'ok' }
    : { ready: false, reason: 'invalid' }
}

function resolveKey(): Buffer {
  const { ready, reason } = describePayConfigKey()

  if (ready) {
    return decodeKey(readRawKey())
  }

  throw new AppError(
    reason === 'invalid'
      ? 'module.system.payChannel.configKeyInvalid'
      : 'module.system.payChannel.configKeyMissing'
  )
}

/** 供渠道配置页提示用：当前环境是否具备可用的加密密钥 */
export function hasPayConfigKey() {
  return describePayConfigKey().ready
}

export function isSecretEnvelope(value: unknown): value is SecretEnvelope {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<SecretEnvelope>
  return candidate.v === ENVELOPE_VERSION
    && candidate.alg === ALGORITHM
    && typeof candidate.iv === 'string'
    && typeof candidate.tag === 'string'
    && typeof candidate.data === 'string'
}

export function encryptSecret(plain: string): SecretEnvelope {
  const key = resolveKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])

  return {
    v: ENVELOPE_VERSION,
    alg: ALGORITHM,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64')
  }
}

export function decryptSecret(envelope: SecretEnvelope): string {
  const key = resolveKey()
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(envelope.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))

  try {
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.data, 'base64')),
      decipher.final()
    ]).toString('utf8')
  } catch (error) {
    throw new AppError('module.system.payChannel.decryptFailed', {
      message: error instanceof Error ? error.message : 'decrypt failed',
      cause: error
    })
  }
}

/** 掩码：只保留末 4 位，供列表与详情展示 */
export function maskSecretValue(value: unknown): string {
  const text = typeof value === 'string' ? value : ''

  if (!text) {
    return ''
  }

  return text.length > 4 ? `${MASK_PREFIX}${text.slice(-4)}` : MASK_PREFIX
}

/**
 * 写入前加密。
 * - 空字符串 / undefined 直接剔除，避免把空密钥写进库；
 * - 已经是密文信封的保持原样（幂等，便于重复保存）；
 * - 非字符串值按原样保留（例如 number / boolean 型配置项）。
 */
export function encryptConfigSecrets(
  fields: PayProviderField[],
  config: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const source = config ?? {}
  const secretKeys = new Set(fields.filter(field => field.secret).map(field => field.key))
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null || value === '') {
      continue
    }

    if (secretKeys.has(key) && typeof value === 'string' && !isSecretEnvelope(value)) {
      result[key] = encryptSecret(value)
      continue
    }

    result[key] = value
  }

  return result
}

/**
 * 读取前解密。非信封值（历史明文数据）原样返回，保证向前兼容。
 */
export function decryptConfigSecrets(
  fields: PayProviderField[],
  config: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const source = config ?? {}
  const secretKeys = new Set(fields.filter(field => field.secret).map(field => field.key))
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(source)) {
    if (secretKeys.has(key) && isSecretEnvelope(value)) {
      result[key] = decryptSecret(value)
      continue
    }

    result[key] = value
  }

  return result
}

/** 列表 / 详情返回给前端前，把密钥字段替换为掩码 */
export function maskConfigSecrets(
  fields: PayProviderField[],
  config: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const source = config ?? {}
  const secretKeys = new Set(fields.filter(field => field.secret).map(field => field.key))
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(source)) {
    result[key] = secretKeys.has(key) ? maskSecretValue(value) : value
  }

  return result
}

/**
 * 更新时的密钥字段处理：留空 / 掩码值表示「不修改」，
 * 其余情况交给 encryptConfigSecrets 加密。
 */
export function isUnchangedSecretInput(value: unknown) {
  if (value === undefined || value === null) {
    return true
  }

  if (typeof value !== 'string') {
    return false
  }

  const trimmed = value.trim()
  return trimmed === '' || trimmed.startsWith(MASK_PREFIX)
}
