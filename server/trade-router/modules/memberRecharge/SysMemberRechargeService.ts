import { sysMemberRechargeRepo } from './SysMemberRechargeRepo'
import type { Context } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'
import { isDuplicateKeyError } from '#server/utils/dbError'
import type { OrmPageResp } from '#server/utils/ApiResp'
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
import type { SysMemberUserOptionQueryDTO } from '#shared/system/member'
import { randomUuid } from '#shared/utils/uuid'

/** 已到账（OD）的充值单是入账凭证：既不能改，也不能删 */
const CREDITED_STATUS = 'OD'
/** 缺省状态：待支付 */
const DEFAULT_STATUS = 'WP'

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

        /** 已到账单据禁止修改，其余只允许改备注 */        async updateById(id: string, data: SysMemberRechargeUpdateDTO): Promise<boolean> {
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

        /**
         * 详情：联表带出优惠码名称与关联支付单信息，供前端展示与二级弹窗使用。
         * 返回的行除充值单字段外还含 `coupon*` 与 `linkedPay*` 两组前缀字段。
         */
        async getById(id: string) {
            const profile = await repo.getProfileById(id)

            if (!profile) {
                throw new AppError('common.notExist')
            }

            return profile
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
         * 关闭充值单：交给领域层的 `close` 一站式处理 ——
         * 只有 WP 可关闭（CL 幂等返回、其它状态报错）、置 CL 并把原因写入 fail_reason、
         * **同时关闭关联的渠道支付单**、释放占用的优惠码。
         *
         * 「必须关闭渠道支付单」这点很关键：否则渠道侧仍是待支付，
         * 会员端轮询同步会一直拿到 WP，界面永远停在「自动同步中」。
         */
        async close(req: SysMemberRechargeCloseDTO): Promise<boolean> {
            const result = await recharges.close({
                rechargeId: req.id,
                reason: req.reason ?? null,
                operatorId: ctx.user?.id ?? null
            })

            return result.closed || result.reused
        },

        /**
         * 会员下拉搜索（补录充值选人）。
         * 充值只能落到已有会员档案的用户，这里固定 scope=member，忽略前端传的 scope。
         */
        async userOptions(input: SysMemberUserOptionQueryDTO) {
            return await member.searchUserOptions({
                keyword: input.keyword ?? null,
                limit: input.limit,
                scope: 'member'
            })
        }
    }
}
