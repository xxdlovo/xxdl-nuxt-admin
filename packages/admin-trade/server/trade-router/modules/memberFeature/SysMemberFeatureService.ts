import { useLogger } from 'evlog'
import { sysMemberFeatureRepo } from './SysMemberFeatureRepo'
import type { Context } from '#admin/server/trpc/context'
import { AppError } from '#admin/server/utils/appError'
import { UNLIMITED } from '#admin/shared/entitlement/types'
import { listEntitlementResolvers } from '#admin/server/utils/entitlementGuard'
import { memberFeatureCacheService } from '#trade/server/storage/cache/MemberFeatureCacheService'
import { randomUuid } from '#admin/shared/utils/uuid'
import type { OrmPageResp } from '#admin/server/utils/ApiResp'
import type {
    SysMemberFeatureAddDTO,
    SysMemberFeatureKind,
    SysMemberFeaturePageQueryDTO,
    SysMemberFeatureUpdateDTO
} from '#trade/shared/system/memberFeature'

/**
 * 取值校验：两类功能的可选值完全不同。
 * - `switch`：只允许 0 / 1；
 * - `quota`：允许 -1（`UNLIMITED`，不限）或 >= 0 的额度。
 * `value`（等级矩阵）与 `defaultValue`（目录默认值）共用这一份规则。
 */
function assertFeatureValue(kind: SysMemberFeatureKind, value: number, errorKey: string): void {
    if (!Number.isInteger(value)) {
        throw new AppError(errorKey, { message: String(value) })
    }

    if (kind === 'switch') {
        if (value !== 0 && value !== 1) {
            throw new AppError(errorKey, { message: String(value) })
        }

        return
    }

    if (value !== UNLIMITED && value < 0) {
        throw new AppError(errorKey, { message: String(value) })
    }
}

/**
 * 计量键校验（避免「填了配额没人能计量」）：
 * - `kind = quota`：resolverKey 必填，必须在 `registerEntitlementResolver` 注册过；
 * - `kind = switch`：resolverKey 必须为空（开关不计量，留着只会误导）。
 *
 * 计量器键与功能键**解耦**：基座守卫用 `meta.resolverKey ?? 功能键` 查计量器
 * （见 core `assertEntitlement`），因此多个功能可以共用一个计量器
 * （如 `student.max` / `student.export` 都按 `studentCount` 统计），
 * 后台只需保证填的键「确实注册过」即可，不存在「必须等于 feature_key」的约束。
 *
 * 返回规范化后的值：quota 返回 trim 后的键，switch 返回 null。
 */
function normalizeResolverKey(
    kind: SysMemberFeatureKind,
    resolverKey: string | null | undefined
): string | null {
    const key = (resolverKey ?? '').trim()

    if (kind === 'quota') {
        if (!key) {
            throw new AppError('module.system.memberFeature.resolverRequired')
        }

        if (!listEntitlementResolvers().includes(key)) {
            throw new AppError('module.system.memberFeature.resolverNotRegistered', { message: key })
        }

        return key
    }

    if (key) {
        throw new AppError('module.system.memberFeature.resolverNotAllowed', { message: key })
    }

    return null
}

/** 可空文本统一 trim，空串归一为 NULL，避免出现 '' 与 NULL 两种「空」 */
function normalizeText(value: string | null | undefined): string | null {
    const text = typeof value === 'string' ? value.trim() : ''
    return text ? text : null
}

export function sysMemberFeatureService(ctx: Context) {
    const repo = sysMemberFeatureRepo(ctx)
    // evlog 宽事件：只记动作与标识（id / 功能键），不打印完整入参出参
    const log = useLogger(ctx.event, 'server/trade-router/memberFeature')
    // 功能目录是 entitlement 的读取源，任何写入口成功之后都必须失效（TTL 只是兜底）
    const cache = memberFeatureCacheService()

    return {
        /**
         * 新增功能：feature_key 全局唯一；kind / resolverKey / defaultValue 三者必须自洽。
         * `defaultValue` 不传时按 kind 兜底：switch → 1（默认开启）、quota → 0（默认无额度）。
         */
        async create(data: SysMemberFeatureAddDTO): Promise<boolean> {
            const featureKey = data.featureKey.trim()

            if (await repo.findByFeatureKey(featureKey)) {
                throw new AppError('module.system.memberFeature.featureKeyExists', { message: featureKey })
            }

            const kind: SysMemberFeatureKind = data.kind ?? 'switch'
            const resolverKey = normalizeResolverKey(kind, data.resolverKey)
            const defaultValue = data.defaultValue ?? (kind === 'switch' ? 1 : 0)

            assertFeatureValue(kind, defaultValue, 'module.system.memberFeature.defaultValueInvalid')

            const id = randomUuid()

            await repo.create({
                id,
                featureKey,
                name: data.name.trim(),
                kind,
                unit: normalizeText(data.unit),
                groupName: normalizeText(data.groupName),
                sortOrder: data.sortOrder ?? 0,
                defaultValue,
                resolverKey,
                adminBypass: data.adminBypass ?? 1,
                userShow: data.userShow ?? 1,
                status: data.status ?? 1
            })

            await cache.invalidateCatalog()

            log.info('memberFeature created', { memberFeature: { action: 'create', id, featureKey, kind } })
            return true
        },

        /**
         * 修改功能。
         *
         * - `featureKey` **不可修改**：带了且与原值不同就直接报错（同值视为无操作）；
         * - `kind` / `resolverKey` / `defaultValue` 重新做一次一致性校验：
         *   switch → quota 必须补已有的计量键，quota → switch 会把计量键清空；
         * - 其余字段未传即保持原值（`undefined` 不写库）。
         */
        async updateById(id: string, data: SysMemberFeatureUpdateDTO): Promise<boolean> {
            const row = await repo.getById(id)

            if (!row) {
                throw new AppError('common.notExist')
            }

            if (data.featureKey && data.featureKey.trim() !== row.featureKey) {
                throw new AppError('module.system.memberFeature.featureKeyImmutable', { message: data.featureKey })
            }

            const kind: SysMemberFeatureKind = data.kind ?? (row.kind === 'quota' ? 'quota' : 'switch')
            // resolverKey 的「未传」是保持原值；但 kind 变了就必须重新确认（switch→quota 不能沿用空值）
            const resolverInput = data.resolverKey === undefined
                ? (kind === row.kind ? row.resolverKey : null)
                : data.resolverKey
            const resolverKey = normalizeResolverKey(kind, resolverInput)
            const defaultValue = data.defaultValue ?? Number(row.defaultValue ?? 0)

            assertFeatureValue(kind, defaultValue, 'module.system.memberFeature.defaultValueInvalid')

            await repo.updateById(id, {
                // 名称留空（null / ''）视为「保持原值」，避免把 NOT NULL 列写成 NULL
                name: data.name === undefined ? undefined : normalizeText(data.name) ?? row.name,
                kind,
                unit: data.unit === undefined ? undefined : normalizeText(data.unit),
                groupName: data.groupName === undefined ? undefined : normalizeText(data.groupName),
                sortOrder: data.sortOrder,
                defaultValue,
                resolverKey,
                adminBypass: data.adminBypass,
                userShow: data.userShow,
                status: data.status
            })

            await cache.invalidateCatalog()

            log.info('memberFeature updated', { memberFeature: { action: 'update', id, featureKey: row.featureKey, kind } })
            return true
        },

        /**
         * 删除功能（软删除）。
         *
         * 刻意**不**清理各等级 `sys_member_level_feature` 里的同名行：
         * 目录是读取源，目录里没有的键不会进入 features，残留矩阵行是惰性数据；
         * 反过来，恢复（重新创建同键）时那些旧值还能直接复用。目录缓存必须失效。
         */
        async remove(id: string): Promise<boolean> {
            await repo.remove(id)
            await cache.invalidateCatalog()

            log.info('memberFeature removed', { memberFeature: { action: 'remove', id } })
            return true
        },

        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            await cache.invalidateCatalog()

            log.info('memberFeature batch removed', { memberFeature: { action: 'batchRemove', count: ids.length } })
            return ids.length
        },

        async page(req: SysMemberFeaturePageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req

            const result = await repo.page(page, pageSize, dto, repo.featureListOrder())

            log.info('memberFeature page queried', {
                memberFeature: { action: 'page', page, pageSize, total: result.total }
            })

            return result
        },

        /**
         * 已注册的**计量器键**清单（`listEntitlementResolvers()` 原样返回，不是功能键）。
         *
         * 前端新增 / 编辑配额功能时用它做下拉，选中的键存进 `resolver_key`；
         * 服务端保存时再校验一次「已注册」（清单来自 core `entitlementGuard` 的注册表，
         * 是唯一事实来源）。多个功能可以选同一个键（共用计量器）。
         */
        async resolvers(): Promise<string[]> {
            return listEntitlementResolvers()
        }
    }
}
