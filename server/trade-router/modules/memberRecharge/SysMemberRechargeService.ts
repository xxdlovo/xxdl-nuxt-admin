import { sysMemberRechargeRepo } from './SysMemberRechargeRepo'
import type { Context } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import { isDuplicateKeyError } from '#server/trade-router/domain/wallet/repo/sqlUtils'
import { normalizeMoney, subMoney } from '#server/trade-router/domain/wallet/utils'
import { memberService } from '#server/trade-router/domain/member/MemberService'
import { rechargeService } from '#server/trade-router/domain/wallet/RechargeService'
import { buildOutTradeNo, nowForMysql } from '#server/trade-router/domain/pay/utils'
import type {
    SysMemberRechargeAddDTO,
    SysMemberRechargeCloseDTO,
    SysMemberRechargeDto,
    SysMemberRechargePageQueryDTO,
    SysMemberRechargeQueryDTO,
    SysMemberRechargeUpdateDTO
} from '#shared/system/memberRecharge'
import { randomUuid } from '#shared/utils/uuid'

/** 已到账（OD）的充值单是入账凭证：既不能改，也不能删 */
const CREDITED_STATUS = 'OD'
/** 缺省状态：待支付 */
const DEFAULT_STATUS = 'WP'
/** 只有待支付可关闭（与领域层 rechargeRepo.markClosed 的守卫一致） */
const CLOSABLE_STATUS = 'WP'

/** 批量操作先按 id 去重，避免重复 id 让「全部存在」的校验误判 */
function uniqIds(ids: string[]) {
    return Array.from(new Set(ids))
}

function isBlank(value: unknown) {
    return value === undefined || value === null || value === ''
}

export function sysMemberRechargeService(ctx: Context) {
    const repo = sysMemberRechargeRepo(ctx)
    // 关闭充值单要释放占用的优惠码，会员领域逻辑不在这里重复实现
    const member = memberService(ctx.db)
    // 补录成「已到账」时走领域到账（唯一到账入口），保证幂等与余额一致
    const recharges = rechargeService(ctx.db)

    return {
        /**
         * 手工补录充值单：只落库，不发起支付。
         * 单号缺失时按 PAY + 时间戳 + 6 位随机码生成，幂等最终由 uk_member_recharge_out 保证。
         */
        async create(data: SysMemberRechargeAddDTO): Promise<boolean> {
            const amount = normalizeMoney(data.amount)
            const giftAmount = normalizeMoney(data.giftAmount ?? '0.00', { allowZero: true })
            const discountAmount = normalizeMoney(data.discountAmount ?? '0.00', { allowZero: true })
            // 实付 = 面额 - 优惠码抵扣；前端没给就按公式算，给了就用给定值
            const payAmount = isBlank(data.payAmount)
                ? subMoney(amount, discountAmount)
                : normalizeMoney(data.payAmount, { allowZero: true })
            const status = data.status ?? DEFAULT_STATUS
            const now = nowForMysql()
            const outTradeNo = data.outTradeNo?.trim() || buildOutTradeNo('PAY')
            /** 补录成「已到账」时，先落 WP 再走领域到账，保证「有单据必有钱」且幂等 */
            const shouldCredit = status === CREDITED_STATUS

            try {
                await repo.create({
                    ...data,
                    id: randomUuid(),
                    outTradeNo,
                    amount,
                    giftAmount,
                    discountAmount,
                    payAmount,
                    status: shouldCredit ? DEFAULT_STATUS : status,
                    // 补录的已到账单据保留管理端给的支付时间，入账时间与状态由领域层写
                    paidAt: data.paidAt ?? null,
                    creditedAt: null,
                    createdAt: now
                })
            } catch (error) {
                if (isDuplicateKeyError(error)) {
                    throw new AppError('module.system.memberRecharge.outTradeNoExists')
                }
                throw error
            }

            if (shouldCredit) {
                await recharges.credit(outTradeNo, ctx.user?.id ?? null)
            }

            return true
        },

        /** 已到账单据禁止修改，其余只允许改备注 */
        async updateById(id: string, data: SysMemberRechargeUpdateDTO): Promise<boolean> {
            const row = await repo.getById(id)

            if (!row) {
                throw new AppError('common.notExist')
            }
            if (row.status === CREDITED_STATUS) {
                throw new AppError('module.system.memberRecharge.creditedReadonly')
            }

            await repo.updateById(id, { remark: data.remark ?? null })
            return true
        },

        /** 软删除：已到账单据禁止删除 */
        async remove(id: string): Promise<boolean> {
            const row = await repo.getById(id)

            if (!row) {
                throw new AppError('common.notExist')
            }
            if (row.status === CREDITED_STATUS) {
                throw new AppError('module.system.memberRecharge.creditedReadonly')
            }

            await repo.remove(id)
            return true
        },

        /** 批量软删除：任一单据已到账就整批拒绝，不做部分成功 */
        async batchRemove(ids: string[]): Promise<number> {
            const uniqueIds = uniqIds(ids)

            if (uniqueIds.length === 0) {
                return 0
            }

            const rows = await repo.listByIds(uniqueIds)

            if (rows.length !== uniqueIds.length) {
                throw new AppError('common.notExist')
            }
            if (rows.some(row => row.status === CREDITED_STATUS)) {
                throw new AppError('module.system.memberRecharge.creditedReadonly')
            }

            await repo.batchRemove(uniqueIds)
            return uniqueIds.length
        },

        async getOne(req: SysMemberRechargeQueryDTO): Promise<SysMemberRechargeDto> {
            const pojo = await repo.getOne(req)

            if (!pojo) {
                throw new AppError('common.notExist')
            }

            return pojo as SysMemberRechargeDto
        },

        async getById(id: string): Promise<SysMemberRechargeDto> {
            const pojo = await repo.getById(id)

            if (!pojo) {
                throw new AppError('common.notExist')
            }

            return pojo as SysMemberRechargeDto
        },

        async page(req: SysMemberRechargePageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, amountMin, amountMax, createdFrom, createdTo, ...dto } = req

            return await repo.pageWithRange(page, pageSize, dto, {
                amountMin,
                amountMax,
                createdFrom,
                createdTo
            })
        },

        /**
         * 关闭充值单：先读单确认状态（只有 WP 可关闭），再置为 CL；
         * 该单占用的优惠码必须释放，否则用户后续充值用不了（领域层幂等，重复调用安全）。
         */
        async close(req: SysMemberRechargeCloseDTO): Promise<boolean> {
            const row = await repo.getById(req.id)

            if (!row) {
                throw new AppError('common.notExist')
            }
            if (row.status !== CLOSABLE_STATUS) {
                throw new AppError('module.system.memberRecharge.notClosable')
            }

            await repo.markClosed(row.id, req.reason ?? null)

            if (row.couponId) {
                await member.releaseCoupon({
                    bizNo: row.outTradeNo,
                    operatorId: ctx.user?.id ?? null
                })
            }

            return true
        }
    }
}
