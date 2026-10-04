import { sysMemberLevelRepo } from './SysMemberLevelRepo'
import type { Context } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'
import { memberLevelCacheService } from '#server/sys-router/storage/cache/MemberLevelCacheService'
import { normalizeMoney, toCents } from '#server/trade-router/domain/wallet/utils'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type {
    SysMemberLevelAddDTO,
    SysMemberLevelDto,
    SysMemberLevelPageQueryDTO,
    SysMemberLevelQueryDTO,
    SysMemberLevelUpdateDTO
} from '#shared/system/memberLevel'
import { randomUuid } from '#shared/utils/uuid'

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

export function sysMemberLevelService(ctx: Context) {
    const repo = sysMemberLevelRepo(ctx)
    // 等级启用列表是全局缓存，所有写入口成功之后都要显式失效（TTL 只是兜底）
    const levelCache = memberLevelCacheService()

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

            return true
        },

        async remove(id: string): Promise<boolean> {
            await repo.remove(id)
            await levelCache.invalidate()
            return true
        },

        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            await levelCache.invalidate()
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

            return true
        },

        async getOne(req: SysMemberLevelQueryDTO): Promise<SysMemberLevelDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo as SysMemberLevelDto
        },

        async getById(id: string): Promise<SysMemberLevelDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo as SysMemberLevelDto
        },

        async page(req: SysMemberLevelPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req

            return await repo.page(page, pageSize, dto, repo.levelListOrder())
        },

        /**
         * 等级下拉：只返回启用中的等级。
         * 等级是全局字典数据，配套的路由用 proc({ dataScope: false }) 跳过数据范围过滤。
         */
        async list(dto: SysMemberLevelQueryDTO): Promise<SysMemberLevelDto[]> {
            const rows = await repo.list({ ...dto, status: 1 }, repo.levelListOrder())

            return rows as SysMemberLevelDto[]
        }
    }
}
