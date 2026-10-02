import { sysMemberFreezeRepo } from './SysMemberFreezeRepo'
import type { Context } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import { walletService } from '#server/trade-router/domain/wallet/WalletService'
import type { FreezeSettleResult } from '#server/trade-router/domain/wallet/types'
import type {
    SysMemberFreezeDto,
    SysMemberFreezePageQueryDTO,
    SysMemberFreezeQueryDTO,
    SysMemberFreezeReleaseDTO,
    SysMemberFreezeUpdateDTO
} from '#shared/system/memberFreeze'

/** 冻结中的单据还占着用户余额，删除会丢掉释放依据，必须拦下 */
const FROZEN_STATUS = 'FROZEN'

/** 批量操作先按 id 去重，避免重复 id 让「全部存在」的校验误判 */
function uniqIds(ids: string[]) {
    return Array.from(new Set(ids))
}

export function sysMemberFreezeService(ctx: Context) {
    const repo = sysMemberFreezeRepo(ctx)
    // 释放涉及余额回退，资金逻辑全部收敛在领域层，这里只做校验与透传
    const wallet = walletService(ctx.db)

    return {
        /** 冻结单是资金凭证，只允许改备注，其余字段一律忽略 */
        async updateById(id: string, data: SysMemberFreezeUpdateDTO): Promise<boolean> {
            const row = await repo.getById(id)

            if (!row) {
                throw new AppError('common.notExist')
            }

            await repo.updateById(id, { remark: data.remark ?? null })
            return true
        },

        /** 软删除：只允许删非 FROZEN 的单据 */
        async remove(id: string): Promise<boolean> {
            const row = await repo.getById(id)

            if (!row) {
                throw new AppError('common.notExist')
            }
            if (row.status === FROZEN_STATUS) {
                throw new AppError('module.system.memberFreeze.cannotDeleteFrozen')
            }

            await repo.remove(id)
            return true
        },

        /** 批量软删除：任一单据处于 FROZEN 就整批拒绝，不做部分成功 */
        async batchRemove(ids: string[]): Promise<number> {
            const uniqueIds = uniqIds(ids)

            if (uniqueIds.length === 0) {
                return 0
            }

            const rows = await repo.listByIds(uniqueIds)

            if (rows.length !== uniqueIds.length) {
                throw new AppError('common.notExist')
            }
            if (rows.some(row => row.status === FROZEN_STATUS)) {
                throw new AppError('module.system.memberFreeze.cannotDeleteFrozen')
            }

            await repo.batchRemove(uniqueIds)
            return uniqueIds.length
        },

        async getOne(req: SysMemberFreezeQueryDTO): Promise<SysMemberFreezeDto> {
            const pojo = await repo.getOne(req)

            if (!pojo) {
                throw new AppError('common.notExist')
            }

            return pojo as SysMemberFreezeDto
        },

        async getById(id: string): Promise<SysMemberFreezeDto> {
            const pojo = await repo.getById(id)

            if (!pojo) {
                throw new AppError('common.notExist')
            }

            return pojo as SysMemberFreezeDto
        },

        async page(req: SysMemberFreezePageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, createdFrom, createdTo, ...dto } = req

            return await repo.pageWithRange(page, pageSize, dto, { createdFrom, createdTo })
        },

        /**
         * 人工释放冻结单：先确认单据存在（未删除且在当前数据范围内），
         * 再交给领域层释放，返回领域结果 { status, giftAmount, rechargeAmount, reused } 原样给前端。
         */
        async release(req: SysMemberFreezeReleaseDTO): Promise<FreezeSettleResult> {
            const row = await repo.getById(req.id)

            if (!row) {
                throw new AppError('common.notExist')
            }

            return await wallet.release({
                freezeId: row.id,
                reason: req.reason,
                operatorId: ctx.user?.id ?? null
            })
        }
    }
}
