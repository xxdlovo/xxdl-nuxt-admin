//#server/trade-router/modules/memberLevelOrder
import { router, proc } from '~~/server/trpc/init'
import z from 'zod'
import { SysMemberLevelOrderPageQuerySchema } from '#shared/system/memberLevelOrder'
import { sysMemberLevelOrderService } from './SysMemberLevelOrderService'

/** 会员开通单（等级购买 / 续费单据）后台管理 */
const listProc = proc({ permission: 'system:memberLevelOrder:list' })
const editProc = proc({ permission: 'system:memberLevelOrder:edit' })
// 同步会向渠道发起查询并可能推进单据状态（有副作用），单独授权
const queryProc = proc({ permission: 'system:memberLevelOrder:query' })
const delProc = proc({ permission: 'system:memberLevelOrder:del' })

/** 关闭入参：reason 落 fail_reason，供列表与详情展示 */
const closeSchema = z.object({
    id: z.string().min(1, 'form.required').max(36, 'form.required'),
    reason: z.string().max(255).nullish()
})

/** 同步入参（按单据 id，避免前端拿到单号才能操作） */
const syncSchema = z.object({
    id: z.string().min(1, 'form.required').max(36, 'form.required')
})

export const sysMemberLevelOrderRouter = router({
    page: listProc.input(SysMemberLevelOrderPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberLevelOrderService(ctx).page(input)
        }),

    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysMemberLevelOrderService(ctx).getById(input)
        }),

    /** 关闭未支付单据（仅 WP；CL 幂等成功；同时释放冻结并尽力关渠道支付单） */
    close: editProc.input(closeSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberLevelOrderService(ctx).close(input)
        }),

    /** 主动同步支付状态（向渠道查询，已支付则生效） */
    sync: queryProc.input(syncSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberLevelOrderService(ctx).sync(input)
        }),

    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysMemberLevelOrderService(ctx).remove(input)
        }),

    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysMemberLevelOrderService(ctx).batchRemove(input)
        })
})
