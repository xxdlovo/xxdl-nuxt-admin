//#server/trade-router/modules/member
import { router, proc, protectedProcedure } from '~~/server/trpc/init'
import z from 'zod'
import {
    SysMemberAddSchema,
    SysMemberAdjustSchema,
    SysMemberChangeLevelSchema,
    SysMemberGrantSchema,
    SysMemberMyLogQuerySchema,
    SysMemberPageQuerySchema,
    SysMemberQuerySchema,
    SysMemberUpdateSchema,
    SysMemberUserOptionQuerySchema,
    SysMemberCouponCheckSchema,
    SysMemberLevelOptionRespSchema
} from '#shared/system/member'
import {
    SysMemberRechargeCreateSchema,
    SysMemberRechargeOutTradeNoSchema
} from '#shared/system/memberRecharge'
import {
    SysMemberLevelOpenSchema,
    SysMemberLevelOrderNoSchema
} from '#shared/system/memberLevelOrder'
import { sysMemberService } from './SysMemberService'

const listProc = proc({ permission: 'system:member:list' })
const addProc = proc({ permission: 'system:member:add' })
const editProc = proc({ permission: 'system:member:edit' })
const delProc = proc({ permission: 'system:member:del' })
// 资金与等级属高敏感操作，单独授权，方便只读/客服角色排除
const adjustProc = proc({ permission: 'system:member:adjust' })
const grantProc = proc({ permission: 'system:member:grant' })
const levelProc = proc({ permission: 'system:member:level' })

export const sysMemberRouter = router({
    create: addProc.input(SysMemberAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysMemberService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysMemberService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysMemberUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysMemberQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysMemberService(ctx).getById(input)
        }),
    page: listProc.input(SysMemberPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberService(ctx).page(input)
        }),
    list: listProc.input(SysMemberQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberService(ctx).list(input)
        }),

    /** 等级下拉：会员编辑器要用，复用会员查询权限，避免再申请一个权限码 */
    levelOptions: listProc
        .query(async ({ ctx }) => {
            return sysMemberService(ctx).levelOptions()
        }),

    /**
     * 用户下拉搜索（建档选人 / 按会员筛选）。
     * scope=unprofiled 只返回还没有会员档案的用户，scope=member 只返回已有档案的会员。
     */
    userOptions: listProc.input(SysMemberUserOptionQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberService(ctx).userOptions(input)
        }),

    /** 自助校验优惠码（充值 / 下单前主动校验，无效时返回 i18n key 而不是抛错） */
    myCouponCheck: protectedProcedure.input(SysMemberCouponCheckSchema)
        .query(async ({ ctx, input }) => {
            return sysMemberService(ctx).myCouponCheck(input)
        }),

    /** 手工调账：加/减余额，必须带原因与 requestId（幂等） */
    adjust: adjustProc.input(SysMemberAdjustSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberService(ctx).adjust(input)
        }),

    /** 发放赠送金（系统赠送 / 活动赠送），同样带 requestId 幂等 */
    grant: grantProc.input(SysMemberGrantSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberService(ctx).grant(input)
        }),

    /** 手工指定等级 */
    changeLevel: levelProc.input(SysMemberChangeLevelSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberService(ctx).changeLevel(input)
        }),

    /** 补绑上级（单级邀请关系，只能绑一次） */
    bindInviter: editProc.input(z.object({
        userId: z.string().min(1, 'form.required').max(36, 'form.required'),
        inviteCode: z.string().min(1, 'form.required').max(20, 'form.required')
    }))
        .mutation(async ({ ctx, input }) => {
            return sysMemberService(ctx).bindInviter(input)
        }),

    // ── 会员自助（登录即可，不需要管理权限） ────────────────────────────────
    myWallet: protectedProcedure
        .query(async ({ ctx }) => {
            return sysMemberService(ctx).myWallet()
        }),
    myProfile: protectedProcedure
        .query(async ({ ctx }) => {
            return sysMemberService(ctx).myProfile()
        }),
    myLogs: protectedProcedure.input(SysMemberMyLogQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberService(ctx).myLogs(input)
        }),
    myRecharges: protectedProcedure
        .query(async ({ ctx }) => {
            return sysMemberService(ctx).myRecharges()
        }),

    /** 自助发起充值：返回二维码/支付链接，到账由回调或 myRechargeSync 触发 */
    myRecharge: protectedProcedure.input(SysMemberRechargeCreateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberService(ctx).myRecharge(input)
        }),

    /** 查询充值单状态（只读本地库，供页面轮询） */
    myRechargeStatus: protectedProcedure.input(SysMemberRechargeOutTradeNoSchema)
        .query(async ({ ctx, input }) => {
            return sysMemberService(ctx).myRechargeStatus(input)
        }),

    /** 主动同步充值状态（向渠道查询，已支付则到账） */
    myRechargeSync: protectedProcedure.input(SysMemberRechargeOutTradeNoSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberService(ctx).myRechargeSync(input)
        }),
    myCoupons: protectedProcedure
        .query(async ({ ctx }) => {
            return sysMemberService(ctx).myCoupons()
        }),
    myInvitees: protectedProcedure
        .query(async ({ ctx }) => {
            return sysMemberService(ctx).myInvitees()
        }),

    // ── 会员自助：等级价格 / 期限 / 开通续费（登录即可，不需要管理权限） ────────

    /**
     * 可开通的会员等级（价格 / 时长 / 是否长期 / 是否默认 + 服务端算好的开通决策）。
     *
     * 显式声明响应契约（`shared/system/member/output.ts`）：前端 `isActive` / `canOpen` /
     * `blockedReason` 直接来自服务端，不再自己推导；字段与落单硬校验同一份规则。
     */
    myLevelOptions: protectedProcedure
        .output(SysMemberLevelOptionRespSchema)
        .query(async ({ ctx }) => {
            return sysMemberService(ctx).myLevelOptions()
        }),

    /** 我的开通记录 */
    myLevelOrders: protectedProcedure
        .query(async ({ ctx }) => {
            return sysMemberService(ctx).myLevelOrders()
        }),

    /** 自助开通 / 续费等级：余额直接生效，在线返回二维码三件套 */
    myOpenLevel: protectedProcedure.input(SysMemberLevelOpenSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberService(ctx).myOpenLevel(input)
        }),

    /** 查询开通单状态（只读本地库，供页面轮询） */
    myLevelOrderStatus: protectedProcedure.input(SysMemberLevelOrderNoSchema)
        .query(async ({ ctx, input }) => {
            return sysMemberService(ctx).myLevelOrderStatus(input)
        }),

    /** 主动同步开通单状态（向渠道查询，已支付则生效） */
    myLevelOrderSync: protectedProcedure.input(SysMemberLevelOrderNoSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberService(ctx).myLevelOrderSync(input)
        })
})
