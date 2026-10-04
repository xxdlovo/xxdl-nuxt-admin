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
import { nowForMysql } from '#server/trade-router/domain/pay/utils'
import { memberService } from '#server/trade-router/domain/member/MemberService'
import { memberLevelOrderService } from '#server/trade-router/domain/member/MemberLevelOrderService'
import { resolveLevelOpenDecision, type LevelOpenDecision } from '#server/trade-router/domain/member/levelOpenPolicy'
import type { LevelRow } from '#server/trade-router/domain/member/repo/levelRepo'
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
    SysMemberLevelOptionDTO,
    SysMemberLevelOptionRespDTO
} from '#shared/system/member'
import type {
    SysMemberLevelOpenDTO,
    SysMemberLevelOrderNoDTO
} from '#shared/system/memberLevelOrder'
import type {
    SysMemberRechargeCreateDTO,
    SysMemberRechargeOutTradeNoDTO
} from '#shared/system/memberRecharge'
import { sysMemberRepo, type SysMemberListFilters } from './SysMemberRepo'

/** 自助查询分页（我的充值记录 / 我的下级 / 我的开通记录） */
const SELF_PAGE_LIMIT = 100

/** 等级期限是否已过期（自助端展示用；`expire_at` 为 NULL 表示永不过期） */
function isLevelExpired(expireAt: string | null | undefined, now: string): boolean {
    return Boolean(expireAt && expireAt <= now)
}

/**
 * 等级行 + 开通决策 → `myLevelOptions` 返回项（契约见 `shared/system/member/output.ts`）。
 *
 * 显式白名单而不是展开整行：`isDeleted` / `createdBy` / `updatedBy` 等内部字段不透给个人中心，
 * 同时让「返回项字段」与共享 Schema 一一对应，改错字段在 typecheck 阶段就能发现。
 */
function toLevelOption(level: LevelRow, decision: LevelOpenDecision): SysMemberLevelOptionDTO {
    return {
        id: level.id,
        code: level.code,
        name: level.name,
        sortOrder: level.sortOrder ?? null,
        benefit: level.benefit ?? null,
        price: level.price,
        durationDays: level.durationDays,
        isDefault: level.isDefault,
        isLongTerm: level.isLongTerm,
        status: level.status ?? null,
        remark: level.remark ?? null,
        createdAt: level.createdAt,
        updatedAt: level.updatedAt,
        isCurrent: decision.isCurrent,
        isActive: decision.isActive,
        canOpen: decision.canOpen,
        blockedReason: decision.blockedReason
    }
}

export function sysMemberService(ctx: Context) {
    const repo = sysMemberRepo(ctx)
    const members = memberService(ctx.db)
    const wallet = walletService(ctx.db)
    const logs = balanceLogRepo(ctx.db)
    const recharges = rechargeRepo(ctx.db)
    const rechargeOrders = rechargeService(ctx.db)
    const payOrders = payOrderService(ctx.db)
    const levelOrders = memberLevelOrderService(ctx.db)
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
         *
         * 后台选的等级与期限会一并落到档案上（此前 `levelId` 被静默忽略，属既有 bug）：
         * 显式选了等级 → 用它（`levelSource = 'manual'`）；没选 → 分配全局默认等级。
         *
         * 留痕：显式选了等级时，领域层会在**同一事务**里补一条「会员开通记录」
         * （`pay_mode = 'manual'`，不动钱）；分配默认等级不写（那不是开通行为）。
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
                operatorId: operatorId(),
                levelId: data.levelId ?? null,
                expireAt: data.expireAt ?? null
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

        /**
         * 更新：等级与期限变更走领域方法（校验等级可用、写 levelChangedAt / levelStartAt / levelSource），
         * 其余字段直接更新。
         *
         * `longTerm` 不是表字段，只用于告诉领域层「按长期处理」，绝不能落进 drizzle 的 set()。
         * `expireAt === undefined` 表示本次不改期限，`null` 表示清除到期（等同长期）。
         *
         * 留痕：本入口只在 `levelTouched`（等级 / 期限 / 长期标记有改动）时才调领域层，
         * 而领域层还会再判一次「等级或到期时间是否确实变化」—— 两者都拦不住的纯备注 / 状态编辑
         * 不会产生「会员开通记录」（`pay_mode = 'manual'`），避免开通记录退化成操作日志。
         */
        async updateById(id: string, data: SysMemberUpdateDTO): Promise<boolean> {
            const current = await repo.getById(id)

            if (!current) {
                throw new AppError('common.notExist')
            }

            const extra = data as SysMemberUpdateDTO & { longTerm?: boolean | number | null }
            const nextLevelId = data.levelId ?? current.levelId ?? null
            const levelChanged = Boolean(data.levelId && data.levelId !== current.levelId)
            const expireAtTouched = data.expireAt !== undefined
            const levelTouched = levelChanged || expireAtTouched || extra.longTerm !== undefined

            if (nextLevelId && levelTouched) {
                await members.changeLevel({
                    userId: current.userId,
                    levelId: nextLevelId,
                    remark: data.levelRemark,
                    expireAt: data.expireAt,
                    longTerm: extra.longTerm,
                    operatorId: operatorId()
                })
            }

            // 领域层已写过的字段不能再直接落库；longTerm 不是表字段必须剔除
            const patch = { ...data } as Record<string, unknown>
            delete patch.id
            delete patch.levelId
            delete patch.levelRemark
            delete patch.expireAt
            delete patch.longTerm

            // 档案没有等级时无法走领域方法改期限，直接把到期时间写回（避免后台编辑被静默丢弃）
            if (!nextLevelId && expireAtTouched) {
                patch.expireAt = data.expireAt ?? null
            }

            if (Object.keys(patch).length > 0) {
                await repo.updateById(id, patch as Parameters<typeof repo.updateById>[1])
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

        /**
         * 手工指定会员等级与期限。
         * 期限优先级见领域层 `memberService.changeLevel`：长期 → null，
         * 显式 expireAt 优先，都没有则按目标等级的 durationDays 推导。
         *
         * 留痕：等级或到期时间确实变化时，领域层会在**同一事务**里补一条「会员开通记录」
         * （`pay_mode = 'manual'`，不动钱、不写余额流水）；原样回传同一等级与到期时间不写。
         */
        async changeLevel(input: SysMemberChangeLevelDTO) {
            await members.changeLevel({
                userId: input.userId,
                levelId: input.levelId,
                remark: input.remark ?? null,
                expireAt: input.expireAt,
                longTerm: input.longTerm,
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

        /**
         * 我的会员档案（含邀请码、下级数量、当前等级与期限）。
         *
         * 既有字段 `member` / `levelName` / `inviteeCount` **保持不变**（前端 store 依赖），
         * 本次只做新增：等级售价/时长/长期/默认 与 到期时间/生效时间/来源。
         */
        async myProfile() {
            const user = requireLogin(ctx)
            const [member, inviteeCount, levels] = await Promise.all([
                members.getMember(user.id),
                members.countInvitees(user.id),
                members.listLevels()
            ])
            const level = levels.find(item => item.id === member?.levelId) ?? null
            const expireAt = member?.expireAt ?? null

            return {
                member,
                levelName: level?.name ?? null,
                inviteeCount,
                // ── 新增：当前等级与期限 ──────────────────────────────────────
                levelId: member?.levelId ?? null,
                levelPrice: level?.price ?? null,
                // 数值字段给确定的 0（等级未命中时前端不必再判空）
                levelDurationDays: Number(level?.durationDays ?? 0),
                /**
                 * 当前等级是否长期等级（永不过期、无需续费）。
                 * 这里是**布尔**：「是不是」的语义在前端直接当条件用；
                 * 等级字典本身（sysMemberLevel 行）仍保留 tinyint 的 0/1 口径。
                 */
                levelIsLongTerm: Number(level?.isLongTerm ?? 0) === 1,
                /** 当前等级是否默认等级 */
                levelIsDefault: Number(level?.isDefault ?? 0) === 1,
                /** 当前等级到期时间；NULL = 永不过期 */
                expireAt,
                levelStartAt: member?.levelStartAt ?? null,
                levelSource: member?.levelSource ?? null,
                isExpired: isLevelExpired(expireAt, nowForMysql())
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

        // ── 会员自助：等级价格 / 期限 / 开通续费（仅需登录，权限码不参与） ──────

        /**
         * 可开通的会员等级（含价格 / 时长 / 是否长期 / 是否默认）。
         * 与后台下拉同源：`members.listLevels()` 走 `MemberLevelCacheService` 的启用列表缓存。
         *
         * 本次新增「可决策字段」：`isCurrent` / `isActive` / `canOpen` / `blockedReason`。
         * 规则唯一来源是 `levelOpenPolicy.resolveLevelOpenDecision`，与落单前的硬校验
         * （`MemberLevelOrderService.create` → `assertLevelOpenAllowed`）共用，
         * 前端只消费结论，不再自己推导「能不能开通」。
         */
        async myLevelOptions(): Promise<SysMemberLevelOptionRespDTO> {
            const user = requireLogin(ctx)
            const [levels, member, freePaidLevelIds] = await Promise.all([
                members.listLevels(),
                members.getMember(user.id),
                // 0 元等级「已开通过」的判据：一次取全部，避免按等级数发 N 条查询
                levelOrders.listFreePaidLevelIds(user.id)
            ])
            const now = nowForMysql()
            const freePaidLevelIdSet = new Set(freePaidLevelIds)

            return levels.map(level => toLevelOption(level, resolveLevelOpenDecision({
                levelId: level.id,
                price: level.price,
                // 与 `MemberLevelOrderService.create` 同口径：时长 0 天同样按长期处理
                isLongTerm: Number(level.isLongTerm) === 1 || Number(level.durationDays) <= 0,
                currentLevelId: member?.levelId ?? null,
                expireAt: member?.expireAt ?? null,
                now,
                hasFreePaidOrder: freePaidLevelIdSet.has(level.id)
            })))
        },

        /** 我的开通记录（购买 / 续费单据，倒序） */
        async myLevelOrders() {
            const user = requireLogin(ctx)

            return await levelOrders.listByUser(user.id, SELF_PAGE_LIMIT)
        },

        /**
         * 自助开通 / 续费等级：支付通道由领域层分派 ——
         * 免费等级落单即生效；余额在同一事务内冻结+扣款+生效；在线返回二维码三件套。
         */
        async myOpenLevel(input: SysMemberLevelOpenDTO) {
            const user = requireLogin(ctx)

            return await levelOrders.create({
                userId: user.id,
                levelId: input.levelId,
                payMode: input.payMode,
                requestId: input.requestId,
                origin: getRequestURL(ctx.event).origin,
                operatorId: user.id
            })
        },

        /** 查询开通单状态（只读本地库，供页面轮询展示） */
        async myLevelOrderStatus(input: SysMemberLevelOrderNoDTO) {
            const user = requireLogin(ctx)
            const row = await levelOrders.getByOutTradeNo(input.outTradeNo)

            if (!row || row.userId !== user.id) {
                throw new AppError('module.system.memberLevelOrder.notFound')
            }

            return {
                outTradeNo: row.outTradeNo,
                status: row.status,
                failReason: row.failReason ?? null,
                effectiveAt: row.effectiveAt ?? null,
                endAt: row.endAt ?? null
            }
        },

        /**
         * 主动同步开通单状态：向渠道查询支付单，若已支付则触发生效（幂等）。
         * 回调不可达（内网 / 本地开发）时，页面靠它把等级补上。
         * 返回的 `status` 一律是**本地开通单**的状态（与 `myRechargeSync` 同构）。
         */
        async myLevelOrderSync(input: SysMemberLevelOrderNoDTO) {
            const user = requireLogin(ctx)
            const row = await levelOrders.getByOutTradeNo(input.outTradeNo)

            if (!row || row.userId !== user.id) {
                throw new AppError('module.system.memberLevelOrder.notFound')
            }

            return await levelOrders.sync({
                outTradeNo: row.outTradeNo,
                operatorId: user.id
            })
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
