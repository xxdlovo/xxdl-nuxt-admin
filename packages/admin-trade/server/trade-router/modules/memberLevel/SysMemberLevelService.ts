import { useLogger } from 'evlog'
import { sysMemberLevelRepo } from './SysMemberLevelRepo'
import { sysMemberLevelFeatureRepo } from './SysMemberLevelFeatureRepo'
import { memberLevelFeatureMatrix } from './matrix'
import { memberFeatureCatalog } from '../memberFeature/catalog'
import type { Context } from '#admin/server/trpc/context'
import { AppError } from '#admin/server/utils/appError'
import { UNLIMITED } from '#admin/shared/entitlement/types'
import { memberLevelCacheService } from '#trade/server/storage/cache/MemberLevelCacheService'
import { memberFeatureCacheService } from '#trade/server/storage/cache/MemberFeatureCacheService'
import { normalizeMoney, toCents } from '#trade/server/trade-router/domain/wallet/utils'
import type { OrmPageResp } from '#admin/server/utils/ApiResp'
import type {
    SysMemberFeatureKind,
    SysMemberLevelFeatureMatrixDTO,
    SysMemberLevelSaveFeaturesDTO
} from '#trade/shared/system/memberFeature'
import type {
    SysMemberLevelAddDTO,
    SysMemberLevelDto,
    SysMemberLevelPageQueryDTO,
    SysMemberLevelQueryDTO,
    SysMemberLevelUpdateDTO
} from '#trade/shared/system/memberLevel'
import { randomUuid } from '#admin/shared/utils/uuid'

/**
 * 价格 / 时长 / 长期 三者的一致性校验（规则 1，放 Service 层）：
 * - `price > 0`（付费等级）：`isLongTerm` 必须为 0，且 `durationDays >= 1`；
 * - `price = 0`（免费等级）：`isLongTerm` 可设 1；此时把 `durationDays` 归 0，
 *   避免出现「长期但有时长」这种自相矛盾的配置；
 * - `durationDays = 0` 且 `isLongTerm = 0` 的免费等级按「不设期限（长期）」处理，
 *   与 shared/system/memberLevel/common.ts 的注释保持一致。
 */
function normalizePricePlan(data: {
    price?: string | number | null
    durationDays?: number | null
    isLongTerm?: number | null
}): { price: string, durationDays: number, isLongTerm: number } {
    const price = normalizeMoney(data.price ?? '0.00', { allowZero: true })
    const isPaid = toCents(price) > 0
    const isLongTerm = Number(data.isLongTerm ?? 0) === 1 ? 1 : 0
    const durationDays = Math.max(0, Math.floor(Number(data.durationDays ?? 0) || 0))

    if (isPaid && isLongTerm === 1) {
        throw new AppError('module.system.memberLevel.longTermRequiresFreePrice')
    }

    if (isPaid && durationDays < 1) {
        throw new AppError('module.system.memberLevel.durationDaysRequired')
    }

    return {
        price,
        durationDays: isLongTerm === 1 ? 0 : durationDays,
        isLongTerm
    }
}

/** 目录 kind 归一：库里是 varchar(10)，只有 'quota' 走配额分支，其余一律按开关处理 */
function normalizeFeatureKind(kind: string | null | undefined): SysMemberFeatureKind {
    return kind === 'quota' ? 'quota' : 'switch'
}

/**
 * 等级能力矩阵的取值校验（与目录 defaultValue 共用同一套语义）：
 * - `switch`：只允许 0 / 1；
 * - `quota`：允许 -1（`UNLIMITED`，不限）或 >= 0 的额度。
 */
function assertMatrixValue(kind: SysMemberFeatureKind, featureKey: string, value: number): void {
    if (!Number.isInteger(value)) {
        throw new AppError('module.system.memberFeature.valueInvalid', { message: `${featureKey}=${value}` })
    }

    if (kind === 'switch') {
        if (value !== 0 && value !== 1) {
            throw new AppError('module.system.memberFeature.valueInvalid', { message: `${featureKey}=${value}` })
        }

        return
    }

    if (value !== UNLIMITED && value < 0) {
        throw new AppError('module.system.memberFeature.valueInvalid', { message: `${featureKey}=${value}` })
    }
}

export function sysMemberLevelService(ctx: Context) {
    const repo = sysMemberLevelRepo(ctx)
    // 等级 × 功能值矩阵（能力项数回填 / 整体覆盖）
    const matrixRepo = sysMemberLevelFeatureRepo(ctx)
    // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
    const log = useLogger(ctx.event, 'server/trade-router/memberLevel')
    // 等级启用列表是全局缓存，所有写入口成功之后都要显式失效（TTL 只是兜底）
    const levelCache = memberLevelCacheService()
    // 等级矩阵按等级缓存：等级被删除 / 整体覆盖之后失效
    const featureCache = memberFeatureCacheService()

    return {
        /** 新增：code 全局唯一，先判重再落库，避免把唯一索引冲突抛成数据库错误 */
        async create(data: SysMemberLevelAddDTO): Promise<boolean> {
            if (await repo.findByCode(data.code)) {
                throw new AppError('module.system.memberLevel.codeExists')
            }

            const plan = normalizePricePlan(data)
            const id = randomUuid()

            await repo.create({
                ...data,
                ...plan,
                id,
                // 缺省启用：契约 Schema 已声明 default，这里兜底直接调用 Service 的情况
                status: data.status ?? 1
            })

            // 设为默认等级：清掉其它等级的 is_default（全局唯一），并随缓存失效生效
            if (Number(data.isDefault ?? 0) === 1) {
                await repo.setDefault(id)
            }

            await levelCache.invalidate()

            log.info('memberLevel created', { memberLevel: { action: 'create', id } })
            return true
        },

        async remove(id: string): Promise<boolean> {
            await repo.remove(id)
            await levelCache.invalidate()
            // 等级已删除：它的能力矩阵不再有读者，缓存顺手清掉
            // （sys_member_level_feature 里的旧行保留，重新建同 id 或恢复时还能复用）
            await featureCache.invalidateLevelMatrix(id)
            log.info('memberLevel removed', { memberLevel: { action: 'remove', id } })
            return true
        },

        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            await levelCache.invalidate()
            await Promise.all(ids.map(id => featureCache.invalidateLevelMatrix(id)))
            log.info('memberLevel batch removed', { memberLevel: { action: 'batchRemove', count: ids.length } })
            return ids.length
        },

        /** 修改：换码时同样要判重（排除自身），保证 code 始终唯一 */
        async updateById(id: string, data: SysMemberLevelUpdateDTO): Promise<boolean> {
            const row = await repo.getById(id)

            if (!row) {
                throw new AppError('common.notExist')
            }

            const existing = await repo.findByCode(data.code)

            if (existing && existing.id !== id) {
                throw new AppError('module.system.memberLevel.codeExists')
            }

            const plan = normalizePricePlan(data)

            // 启停、排序、改名、价格与期限都会影响启用列表（含缓存里的展示字段），一律失效
            await repo.updateById(id, { ...data, ...plan })

            if (Number(data.isDefault ?? 0) === 1) {
                await repo.setDefault(id)
            }

            await levelCache.invalidate()

            log.info('memberLevel updated', { memberLevel: { action: 'update', id } })
            return true
        },

        async getOne(req: SysMemberLevelQueryDTO): Promise<SysMemberLevelDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            log.info('memberLevel fetched', { memberLevel: { action: 'getOne' } })
            return pojo as SysMemberLevelDto
        },

        async getById(id: string): Promise<SysMemberLevelDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            log.info('memberLevel fetched', { memberLevel: { action: 'getById', id } })
            return pojo as SysMemberLevelDto
        },

        async page(req: SysMemberLevelPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req

            const result = await repo.page(page, pageSize, dto, repo.levelListOrder())
            const rows = result.list as SysMemberLevelDto[]
            // 列表带出「已配置能力项数」：一次分组统计回填，避免逐行查矩阵
            const counts = await matrixRepo.countByLevelIds(
                rows.map(row => row.id).filter((id): id is string => Boolean(id))
            )

            log.info('memberLevel page queried', {
                memberLevel: { action: 'page', page, pageSize, total: result.total }
            })

            return {
                ...result,
                list: rows.map(row => ({ ...row, featureCount: row.id ? counts[row.id] ?? 0 : null }))
            }
        },

        /**
         * 等级下拉：只返回启用中的等级。
         * 等级是全局字典数据，配套的路由用 proc({ dataScope: false }) 跳过数据范围过滤。
         */
        async list(dto: SysMemberLevelQueryDTO): Promise<SysMemberLevelDto[]> {
            const rows = await repo.list({ ...dto, status: 1 }, repo.levelListOrder()) as SysMemberLevelDto[]
            // 与 page 同口径回填能力项数（下拉里也会显示「已配置 N 项」）
            const counts = await matrixRepo.countByLevelIds(
                rows.map(row => row.id).filter((id): id is string => Boolean(id))
            )

            log.info('memberLevel listed', { memberLevel: { action: 'list', count: rows.length } })

            return rows.map(row => ({ ...row, featureCount: row.id ? counts[row.id] ?? 0 : null }))
        },

        /**
         * 某个等级的能力矩阵：**全部启用功能** × 该等级取值（带元数据）。
         *
         * 取值口径与 `entitlementSource` 完全一致：等级矩阵有行用行值，没有行回落
         * `defaultValue` —— 后台看到的数字就是用户实际生效的数字。
         * 只读接口，权限沿用 `system:memberLevel:list`。
         */
        async featureMatrix(levelId: string): Promise<SysMemberLevelFeatureMatrixDTO> {
            const level = await repo.getById(levelId)

            if (!level) {
                throw new AppError('common.notExist')
            }

            const [catalog, values] = await Promise.all([
                memberFeatureCatalog(ctx),
                memberLevelFeatureMatrix(ctx, levelId)
            ])

            const items = catalog.map((row) => {
                const kind = normalizeFeatureKind(row.kind)
                const stored = values[row.featureKey]
                // 未配置走目录默认值；目录默认值缺失时再按类型兜底（switch 1 / quota 0）
                const value = typeof stored === 'number'
                    ? stored
                    : Number(row.defaultValue ?? (kind === 'switch' ? 1 : 0))

                return {
                    featureKey: row.featureKey,
                    value,
                    name: row.name,
                    kind,
                    unit: row.unit ?? null,
                    groupName: row.groupName ?? null,
                    sortOrder: Number(row.sortOrder ?? 0),
                    resolverKey: row.resolverKey ?? null,
                    defaultValue: Number(row.defaultValue ?? 0),
                    userShow: Number(row.userShow ?? 1),
                    adminBypass: Number(row.adminBypass ?? 1)
                }
            })

            log.info('memberLevel feature matrix fetched', {
                memberLevel: { action: 'featureMatrix', levelId, featureCount: items.length }
            })

            return { levelId, items }
        },

        /**
         * 保存某个等级的能力矩阵（**整体覆盖**，新权限 `system:memberLevel:feature`）。
         *
         * 语义：传入的 `values` 就是该等级最终的全部配置，
         * 未出现的功能键会被移除（回落为目录默认值），`values: []` = 清空全部显式配置。
         *
         * 校验在落库前一次做完（避免写一半才发现取值非法）：
         * - 等级必须存在；
         * - 功能键必须存在于**启用中的目录**（写进目录里没有的键只会变成惰性数据）；
         * - 同一请求不允许重复键；
         * - switch 只允许 0/1，quota 允许 -1 或 >= 0。
         */
        async saveFeatures(data: SysMemberLevelSaveFeaturesDTO): Promise<boolean> {
            const level = await repo.getById(data.levelId)

            if (!level) {
                throw new AppError('common.notExist')
            }

            const catalog = await memberFeatureCatalog(ctx)
            const featureMap = new Map(catalog.map(row => [row.featureKey, row]))
            const seen = new Set<string>()

            const values = data.values.map((item) => {
                const featureKey = item.featureKey.trim()
                const feature = featureMap.get(featureKey)

                if (!feature) {
                    throw new AppError('module.system.memberFeature.featureUnknown', { message: featureKey })
                }

                if (seen.has(featureKey)) {
                    throw new AppError('module.system.memberFeature.featureDuplicated', { message: featureKey })
                }

                seen.add(featureKey)

                const kind = normalizeFeatureKind(feature.kind)
                assertMatrixValue(kind, featureKey, item.value)

                return { featureKey, value: item.value }
            })

            await matrixRepo.replaceForLevel({
                levelId: data.levelId,
                values,
                operatorId: ctx.user?.id ?? null
            })

            // 整体覆盖成功之后立刻失效该等级的矩阵缓存（TTL 只是兜底）
            await featureCache.invalidateLevelMatrix(data.levelId)

            log.info('memberLevel features saved', {
                memberLevel: { action: 'saveFeatures', levelId: data.levelId, count: values.length }
            })

            return true
        }
    }
}
