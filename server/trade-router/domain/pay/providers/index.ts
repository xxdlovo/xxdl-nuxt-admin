/**
 * 渠道适配器注册表。
 * 新增渠道的固定动作：在这里 import 并登记一行即可，其余层（路由/页面/表结构）无需改动。
 */
import { mockPayProvider } from './mock'
import { xunhuPayProvider } from './xunhupay'
import type { PayProvider, PayProviderMeta } from '../types'

/** mock 渠道：非生产环境默认开启，生产环境必须显式 NUXT_PAY_MOCK_ENABLED=true */
function isMockEnabled() {
  const flag = process.env.NUXT_PAY_MOCK_ENABLED

  if (flag === 'false') {
    return false
  }
  if (flag === 'true') {
    return true
  }

  return process.env.NODE_ENV !== 'production'
}

const providers: Record<string, PayProvider> = {
  [xunhuPayProvider.code]: xunhuPayProvider
}

if (isMockEnabled()) {
  providers[mockPayProvider.code] = mockPayProvider
}

export function getPayProvider(code?: string | null): PayProvider | null {
  if (!code) {
    return null
  }

  return providers[code.trim().toLowerCase()] ?? null
}

export function listPayProviders(): PayProvider[] {
  return Object.values(providers)
}

/** 供前端渲染「渠道类型」下拉与动态表单，绝不包含任何密钥默认值 */
export function listPayProviderMetas(): PayProviderMeta[] {
  return listPayProviders().map(provider => ({
    code: provider.code,
    name: provider.name,
    capabilities: provider.capabilities,
    fields: provider.fields
  }))
}

export function isPayProviderRegistered(code?: string | null) {
  return getPayProvider(code) !== null
}

export type { PayProvider, PayProviderMeta } from '../types'
