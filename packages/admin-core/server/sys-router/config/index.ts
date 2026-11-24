import z from 'zod'
import { publicProcedure, router, proc } from '#admin/server/trpc/init'
import { rateLimitMiddleware } from '#admin/server/trpc/middlewares/rateLimit'
import { SysConfigAddSchema, SysConfigPageQuerySchema, SysConfigQuerySchema, SysConfigUpdateSchema } from '#admin/shared/system/config'
import { sysConfigService } from './SysConfigService'

const listProc = proc({ permission: 'system:config:list' })
const addProc = proc({ permission: 'system:config:add' })
const editProc = proc({ permission: 'system:config:edit' })
const delProc = proc({ permission: 'system:config:del' })

// 公开配置读取：匿名可访问，按 IP 限流（60 次/分钟）。
const publicLimit = rateLimitMiddleware({ limit: 60, windowMs: 60_000, scope: 'public-config' })

export const sysConfigRouter = router({
    create: addProc.input(SysConfigAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysConfigService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysConfigService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysConfigService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysConfigUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysConfigService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysConfigQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysConfigService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysConfigService(ctx).getById(input)
        }),
    /**
     * 公开读取单个配置（无需登录）。
     * 只返回 `publicConfigKeys` 白名单内的 key，其余返回 null。
     * 登录/注册页依赖该接口读取开关，新增公开配置时要同步维护白名单。
     */
    getValueByKey: publicProcedure.use(publicLimit).input(z.string().min(1, 'form.required'))
        .query(async ({ ctx, input }) => {
            return sysConfigService(ctx).getPublicValueByKey(input)
        }),
    /** 公开批量读取配置（无需登录），非白名单 key 静默忽略。 */
    publicValues: publicProcedure.use(publicLimit).input(z.object({
        keys: z.array(z.string().min(1)).min(1).max(20)
    }))
        .query(async ({ ctx, input }) => {
            return sysConfigService(ctx).getPublicValues(input.keys)
        }),
    page: listProc.input(SysConfigPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysConfigService(ctx).page(input)
        })
})
