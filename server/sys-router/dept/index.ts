//#server/sys-router/department
import { router, proc } from '~~/server/trpc/init'
import { sysDeptService } from './SysDeptService'
import z from 'zod'
import { SysDeptAddSchema, SysDeptUpdateSchema, SysDeptQuerySchema, SysDeptPageQuerySchema } from '#shared/system/department'

const addProc = proc({ permission: 'system:dept:add' })
const editProc = proc({ permission: 'system:dept:edit' })
const delProc = proc({ permission: 'system:dept:del' })

// 部门列表类接口需要完整部门树（用于选择器/树形展示），不做数据范围限制
const listProc = proc({ permission: 'system:dept:list', dataScope: false })

export const sysDeptRouter = router({
    create: addProc.input(SysDeptAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysDeptService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysDeptService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysDeptService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysDeptUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysDeptService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysDeptQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysDeptService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysDeptService(ctx).getById(input)
        }),
    page: listProc.input(SysDeptPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysDeptService(ctx).page(input)
        }),
    list: listProc.input(SysDeptQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysDeptService(ctx).list(input)
        })
})
