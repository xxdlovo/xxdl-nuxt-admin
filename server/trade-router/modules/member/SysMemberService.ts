//#server/trade-router/modules/member
/**
 * 会员模块 Service：后台 CRUD + 运营动作（调账 / 发赠送金 / 改等级 / 绑上级） + 会员自助查询。
 *
 * 资金与会员规则一律调用领域层：
 * - `walletService(ctx.db)`：调账、发赠送金、余额与流水；
 * - `memberService(ctx.db)`：建档、绑上级、改等级、优惠码。
 * 本文件不写 SQL、不直接改余额。
 */
import { AppError } from '#server/utils/appError'
import { requireLogin } from '#server/utils/routeGuard'
import { getRequestURL } from 'h3'
import { balanceLogRepo } from '#server/trade-router/domain/wallet/repo/balanceLogRepo'
import { rechargeRepo } from '#server/trade-router/domain/wallet/repo/rechargeRepo'
import { payOrderService } from '#server/trade-router/domain/pay/PayOrderService'
import { memberService } from '#server/trade-router/domain/member/MemberService'
import { rechargeService } from '#server/trade-router/domain/wallet/RechargeService'
import { buildGiftGrantBizNo, walletService } from '#server/trade-router/domain/wallet/WalletService'
import { sysUserRepo } from '#server/sys-router/user/SysUserRepo'
import type { Context } from '#server/trpc/context'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type {
    SysMemberAddDTO,
    SysMemberAdjustDTO,
    SysMemberChangeLevelDTO,
    SysMemberCouponCheckDTO,
    SysMemberGrantDTO,
    SysMemberMyLogQueryDTO,
    SysMemberPageQueryDTO,
    SysMemberQueryDTO,
    SysMemberUpdateDTO,
    SysMemberUserOptionQueryDTO
} from '#shared/system/member'
import type { SysMemberCouponCheckRespDTO } from '#shared/system/member'
import type {
    SysMemberRechargeCreateDTO,
    SysMemberRechargeOutTradeNoDTO
} from '#shared/system/memberRecharge'
import { sysMemberRepo, type SysMemberListFilters } from './SysMemberRepo'

/** 自助查询分页（我的充值记录 / 我的下级） */
const SELF_PAGE_LIMIT = 100

export function sysMemberService(ctx: Context) {
    const repo = sysMemberRepo(ctx)
    const members = memberService(ctx.db)
    const wallet = walletService(ctx.db)
    const logs = balanceLogRepo(ctx.db)
    const recharges = rechargeRepo(ctx.db)
    const rechargeOrders = rechargeService(ctx.db)
    const payOrders = payOrderService(ctx.db)
    const users = sysUserRepo(ctx)

    const operatorId = () => ctx.user?.id ?? null

    /** 把查询 DTO 收敛成 Repo 需要的筛选项 */
    function toFilters(dto: SysMemberQueryDTO): SysMemberListFilters {
        return {
            keyword: dto.keyword ?? null,
            levelId: dto.levelId ?? null,
            inviterId: dto.inviterId ?? null,
            status: dto.status ?? null,
            createdFrom: dto.createdFrom ?? null,
            createdTo: dto.createdTo ?? null
        }
    }

    return {
        /**
         * 手工建档：给已存在的后台用户开一份会员档案。
         * 正常注册/OAuth 首登由 `memberService.onboard` 自动建档，这里是补录入口。
         */
        async create(data: SysMemberAddDTO): Promise<boolean> {
            const user = await users.getActiveById(data.userId)

            if (!user) {
                throw new AppError('common.notExist')
            }

            await members.onboard({
                userId: data.userId,
                inviteCode: data.inviteCode ?? null,
                source: 'register',
                operatorId: operatorId()
            })

            return true
        },

        async remove(id: string): Promise<boolean> {
            await repo.remove(id)
            return true
        },

        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            return ids.length
        },

        /** 更新：等级变更走领域方法（会写 levelChangedAt / 校验等级可用），其余字段直接更新 */
        async updateById(id: string, data: SysMemberUpdateDTO): Promise<boolean> {
            const current = await repo.getById(id)

            if (!current) {
                throw new AppError('common.notExist')
            }

            if (data.levelId && data.levelId !== current.levelId) {
                await members.changeLevel({
                    userId: current.userId,
                    levelId: data.levelId,
                    remark: data.levelRemark ?? null,
                    operatorId: operatorId()
                })
            }

            const { id: _id, levelId: _levelId, levelRemark: _levelRemark, ...rest } = data

            if (Object.keys(rest).length > 0) {
                await repo.updateById(id, rest)
            }

            return true
        },

        async getOne(req: SysMemberQueryDTO): Promise<unknown> {
            const row = await repo.getOne(req as Record<string, unknown>)

            if (!row) {
                throw new AppError('common.notExist')
            }

            return row
        },

        /** 详情：联表返回昵称、等级、钱包余额 */
        async getById(id: string) {
            const profile = await repo.getProfileById(id)

            if (!profile) {
                throw new AppError('common.notExist')
            }

            return profile
        },

        async page(req: SysMemberPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req

            return await repo.pageWithProfile(page, pageSize, toFilters(dto as SysMemberQueryDTO))
        },

        async list(dto: SysMemberQueryDTO) {
            return await repo.list(dto as Record<string, unknown>)
        },

        /**
         * 手工调账：加/减余额。
         * 幂等键由前端的 `requestId` 提供，重复提交只会生效一次。
         */
        async adjust(input: SysMemberAdjustDTO) {
            const result = await wallet.adjust({
                userId: input.userId,
                account: input.account,
                direction: input.direction,
                amount: input.amount,
                reason: input.reason,
                requestId: input.requestId,
                remark: input.remark ?? null,
                operatorId: operatorId()
            })

            return result
        },

        /** 发放赠送金：业务单号带 requestId，重复提交只发一次 */
        async grant(input: SysMemberGrantDTO) {
            const result = await wallet.credit({
                userId: input.userId,
                account: 'gift',
                amount: input.amount,
                bizType: input.source === 'campaign' ? 'gift_campaign' : 'gift_system',
                bizNo: buildGiftGrantBizNo(input.requestId),
                giftSource: input.source,
                giftExpireAt: input.expireAt ?? null,
                reason: '后台发放赠送金',
                remark: input.remark ?? null,
                operatorId: operatorId()
            })

            return result
        },

        /** 手工指定会员等级 */
        async changeLevel(input: SysMemberChangeLevelDTO) {
            await members.changeLevel({
                userId: input.userId,
                levelId: input.levelId,
                remark: input.remark ?? null,
                operatorId: operatorId()
            })

            return true
        },

        /** 补绑上级（单级邀请关系，只能绑一次） */
        async bindInviter(input: { userId: string; inviteCode: string }) {
            return await members.bindInviter({
                userId: input.userId,
                inviteCode: input.inviteCode,
                operatorId: operatorId()
            })
        },

        // ── 会员自助（仅需登录，权限码不参与） ──────────────────────────────

        /** 我的余额（双账 + 冻结 + 可用额） */
        async myWallet() {
            const user = requireLogin(ctx)
            const snapshot = await wallet.getWallet(user.id)
            const member = await members.getMember(user.id)

            return {
                ...snapshot,
                levelId: member?.levelId ?? null,
                inviteCode: member?.inviteCode ?? null,
                inviterId: member?.inviterId ?? null
            }
        },

        /** 我的会员档案（含邀请码与下级数量） */
        async myProfile() {
            const user = requireLogin(ctx)
            const [member, invitees, levels] = await Promise.all([
                members.getMember(user.id),
                members.listInvitees(user.id),
                members.listLevels()
            ])
            const level = levels.find(item => item.id === member?.levelId) ?? null

            return {
                member,
                levelName: level?.name ?? null,
                inviteeCount: invitees.length
            }
        },

        /** 我的余额流水（分页） */
        async myLogs(query: SysMemberMyLogQueryDTO) {
            const user = requireLogin(ctx)
            const { page, pageSize, ...filters } = query

            return await logs.pageByFilters({
                userId: user.id,
                account: filters.account ?? null,
                bizType: filters.bizType ?? null,
                createdFrom: filters.createdFrom ?? null,
                createdTo: filters.createdTo ?? null
            }, page, pageSize)
        },

        /** 我的充值记录 */
        async myRecharges() {
            const user = requireLogin(ctx)

            return await recharges.listByUser(user.id, SELF_PAGE_LIMIT)
        },

        /**
         * 自助发起充值：落充值单 → 调支付模块下单 → 返回二维码信息。
         * 到账由支付回调或主动同步触发（见 myRechargeSync），本方法不直接改余额。
         */
        async myRecharge(input: SysMemberRechargeCreateDTO) {
            const user = requireLogin(ctx)

            return await rechargeOrders.create({
                userId: user.id,
                amount: input.amount,
                couponCode: input.couponCode ?? null,
                notifyUrl: input.notifyUrl ?? null,
                origin: getRequestURL(ctx.event).origin,
                operatorId: user.id
            })
        },

        /** 查询充值单状态（只读本地库，供页面轮询展示） */
        async myRechargeStatus(input: SysMemberRechargeOutTradeNoDTO) {
            const user = requireLogin(ctx)
            const row = await rechargeOrders.findRecharge(input.outTradeNo)

            if (!row || row.userId !== user.id) {
                throw new AppError('module.system.memberRecharge.notFound')
            }

            return {
                outTradeNo: row.outTradeNo,
                status: row.status,
                amount: row.amount,
                payAmount: row.payAmount,
                giftAmount: row.giftAmount,
                paidAt: row.paidAt ?? null,
                creditedAt: row.creditedAt ?? null,
                failReason: row.failReason ?? null
            }
        },

        /**
         * 主动同步充值状态：向渠道查询支付单，若已支付则触发到账（幂等）。
         * 回调不可达（内网/本地开发）时，页面靠它把余额补上。
         *
         * 返回的 `status` 一律是**本地充值单**的状态（而不是渠道支付单的），
         * 这样后台关闭充值单后页面立刻能拿到 CL 并停止轮询；
         * `failReason` 是关闭原因 / 失败原因，供页面直接展示。
         */
        async myRechargeSync(input: SysMemberRechargeOutTradeNoDTO) {
            const user = requireLogin(ctx)
            const row = await rechargeOrders.findRecharge(input.outTradeNo)

            if (!row || row.userId !== user.id) {
                throw new AppError('module.system.memberRecharge.notFound')
            }

            // 已到账 / 已被后台关闭 / 发起失败：本地状态已终结，不再看渠道
            if (row.status !== 'WP') {
                return {
                    outTradeNo: row.outTradeNo,
                    status: row.status,
                    credited: false,
                    reused: row.status === 'OD',
                    failReason: row.failReason ?? null
                }
            }

            if (!row.payOrderId) {
                return {
                    outTradeNo: row.outTradeNo,
                    status: row.status,
                    credited: false,
                    reused: false,
                    failReason: row.failReason ?? null
                }
            }

            const order = await payOrders.queryPayment(row.payOrderId, { operatorId: user.id })

            // 渠道已支付：入账
            if (order.status === 'OD') {
                const credited = await rechargeOrders.credit(row.outTradeNo, user.id)

                return {
                    outTradeNo: row.outTradeNo,
                    status: 'OD',
                    credited: credited.credited,
                    reused: credited.reused,
                    failReason: null
                }
            }

            /**
             * 支付单已经被关闭 / 发起失败（渠道过期、后台关过支付单等）：
             * 反向把充值单也关掉，避免本地永远停在「待支付」让页面无限轮询。
             * 关闭原因回填 fail_reason，页面据此展示并停止展示二维码。
             */
            if (order.status === 'CL' || order.status === 'FL') {
                await rechargeOrders.close({
                    outTradeNo: row.outTradeNo,
                    reason: `支付单已${order.status === 'CL' ? '关闭' : '失败'}`,
                    operatorId: user.id
                })

                const latest = await rechargeOrders.findRecharge(row.outTradeNo)

                return {
                    outTradeNo: row.outTradeNo,
                    status: latest?.status ?? 'CL',
                    credited: false,
                    reused: true,
                    failReason: latest?.failReason ?? null
                }
            }

            // 渠道仍未支付：状态仍按本地单据（WP）返回，页面继续轮询
            return {
                outTradeNo: row.outTradeNo,
                status: row.status,
                credited: false,
                reused: false,
                failReason: null
            }
        },

        /** 我的优惠码使用记录 */
        async myCoupons() {
            const user = requireLogin(ctx)

            return await members.listMyCoupons(user.id)
        },

        /** 我邀请的下级 */
        async myInvitees() {
            const user = requireLogin(ctx)

            return await members.listInvitees(user.id)
        },

        /** 等级下拉（会员编辑器用，避免前端再申请额外权限） */
        async levelOptions() {
            return await members.listLevels()
        },

        /**
         * 自助校验优惠码：充值页在「生成二维码」前主动校验，避免提交后才报错。
         *
         * 返回结构化结果而不是抛错：无效时给 i18n key，前端就地高亮提示；
         * 服务端在真正下单/充值时会用同一套 `resolveCoupon` 再校验一次（这里是前置提示，不是唯一防线）。
         */
        async myCouponCheck(input: SysMemberCouponCheckDTO): Promise<SysMemberCouponCheckRespDTO> {
            const user = requireLogin(ctx)
            const amountText = String(input.amount ?? '').trim()

            try {
                const result = await members.resolveCoupon({
                    code: input.code,
                    userId: user.id,
                    scene: input.scene,
                    amount: amountText || '0.00',
                    // 没填金额时只校验券本身可用，金额相关判定等填了金额再算
                    skipAmountCheck: !amountText
                })

                if (!result) {
                    return {
                        valid: false,
                        reason: 'module.system.member.couponNotFound',
                        code: null,
                        type: null,
                        value: null,
                        minAmount: null,
                        requiredAmount: null,
                        giftAmount: null,
                        discountAmount: null,
                        payableAmount: null
                    }
                }

                return {
                    valid: true,
                    reason: null,
                    code: result.code,
                    type: result.type,
                    value: result.value,
                    minAmount: result.minAmount,
                    requiredAmount: null,
                    giftAmount: result.giftAmount,
                    discountAmount: amountText ? result.discountAmount : null,
                    payableAmount: amountText ? result.payableAmount : null
                }
            } catch (error) {
                if (error instanceof AppError) {
                    /**
                     * 两个「金额相关」的失败要把金额带回给前端：
                     * - `couponMinAmount`  → 门槛金额（最低消费）
                     * - `couponNotApplicable` → 面值大于订单金额时，需要达到的金额
                     * 领域层把金额放在 `message` 里传出来。
                     */
                    const minAmount = error.i18nKey === 'module.system.member.couponMinAmount'
                        ? error.message
                        : null
                    const requiredAmount = error.i18nKey === 'module.system.member.couponNotApplicable'
                        ? error.message
                        : null

                    return {
                        valid: false,
                        reason: error.i18nKey,
                        code: null,
                        type: null,
                        value: null,
                        minAmount,
                        requiredAmount,
                        giftAmount: null,
                        discountAmount: null,
                        payableAmount: null
                    }
                }

                throw error
            }
        },

        /**
         * 用户下拉搜索：建档弹窗用 scope=unprofiled（只列待建档用户），
         * 其它场景用 scope=member（只列已有会员档案的用户）。
         */
        async userOptions(input: SysMemberUserOptionQueryDTO) {
            return await members.searchUserOptions(input)
        }
    }
}

export type SysMemberService = ReturnType<typeof sysMemberService>
