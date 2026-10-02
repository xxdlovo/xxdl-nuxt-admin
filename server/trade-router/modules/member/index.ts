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
    SysMemberUpdateSchema
} from '#shared/system/member'
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
    myCoupons: protectedProcedure
        .query(async ({ ctx }) => {
            return sysMemberService(ctx).myCoupons()
        }),
    myInvitees: protectedProcedure
        .query(async ({ ctx }) => {
            return sysMemberService(ctx).myInvitees()
        })
})
