//#server/trade-router/modules/memberLevel
import { router, proc } from '~~/server/trpc/init'
import { sysMemberLevelService } from './SysMemberLevelService'
import z from 'zod'
import {
    SysMemberLevelAddSchema,
    SysMemberLevelUpdateSchema,
    SysMemberLevelQuerySchema,
    SysMemberLevelPageQuerySchema
} from '#shared/system/memberLevel'

const listProc = proc({ permission: 'system:memberLevel:list' })
const addProc = proc({ permission: 'system:memberLevel:add' })
const editProc = proc({ permission: 'system:memberLevel:edit' })
const delProc = proc({ permission: 'system:memberLevel:del' })
// 等级是全局字典数据，不参与数据权限过滤：下拉与等级展示需要完整的启用等级
const listAllProc = proc({ permission: 'system:memberLevel:list', dataScope: false })

export const sysMemberLevelRouter = router({
    create: addProc.input(SysMemberLevelAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberLevelService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysMemberLevelService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysMemberLevelService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysMemberLevelUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberLevelService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysMemberLevelQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberLevelService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysMemberLevelService(ctx).getById(input)
        }),
    page: listProc.input(SysMemberLevelPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberLevelService(ctx).page(input)
        }),
    // 启用中的等级列表（下拉用）：等级是全局字典数据，不做数据范围过滤
    list: listAllProc.input(SysMemberLevelQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberLevelService(ctx).list(input)
        })
})
