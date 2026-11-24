import { publicConfigKeys, publicDictTypeCodes } from '#admin/shared/constants/business'

/**
 * 公开查询接口的白名单注册表。
 *
 * 默认白名单写在 `#admin/shared/constants/business` 里（layer 自带）。业务系统/业务层
 * 不需要覆盖 layer 文件，只需在自己的 Nitro 插件里追加：
 *
 * ```ts
 * // server/plugins/public-allowlist.ts（宿主或业务层）
 * import {
 *   registerPublicConfigKeys,
 *   registerPublicDictTypes
 * } from '#admin/server/utils/publicAllowlist'
 *
 * export default defineNitroPlugin(() => {
 *   registerPublicDictTypes(['industry_type'])
 *   registerPublicConfigKeys(['site_filing_no'])
 * })
 * ```
 *
 * 约束：
 * - 只能**追加**，不能移除 layer 的默认项（白名单是安全边界，避免误关默认公开项）；
 * - 注册表在服务端运行，客户端无法调用，也不会随产物暴露；
 * - 每次调用 getter 会合并默认值 + 追加值并去重，注册时使缓存失效。
 */

const extraDictTypes = new Set<string>()
const extraConfigKeys = new Set<string>()

let dictTypeCache: string[] | null = null
let configKeyCache: string[] | null = null

/** 追加允许匿名读取的字典类型（如 `industry_type`）。 */
export function registerPublicDictTypes(codes: readonly string[]) {
    let changed = false

    for (const code of codes) {
        const normalized = code?.trim()
        if (normalized && !extraDictTypes.has(normalized)) {
            extraDictTypes.add(normalized)
            changed = true
        }
    }

    if (changed) {
        dictTypeCache = null
    }
}

/** 追加允许匿名读取的系统配置 key（如 `site_filing_no`）。 */
export function registerPublicConfigKeys(keys: readonly string[]) {
    let changed = false

    for (const key of keys) {
        const normalized = key?.trim()
        if (normalized && !extraConfigKeys.has(normalized)) {
            extraConfigKeys.add(normalized)
            changed = true
        }
    }

    if (changed) {
        configKeyCache = null
    }
}

/** 当前生效的公开字典白名单（默认 + 追加，去重）。 */
export function getPublicDictTypeCodes(): string[] {
    dictTypeCache ??= [...new Set([...publicDictTypeCodes, ...extraDictTypes])]
    return dictTypeCache
}

/** 当前生效的公开配置白名单（默认 + 追加，去重）。 */
export function getPublicConfigKeys(): string[] {
    configKeyCache ??= [...new Set([...publicConfigKeys, ...extraConfigKeys])]
    return configKeyCache
}
