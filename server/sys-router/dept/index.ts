//#server/sys-router/department
import { router, crudPermissionProcedures } from '~~/server/trpc/init'
import { sysDeptService } from './SysDeptService'
import z from 'zod'
import { SysDeptAddSchema, SysDeptUpdateSchema, SysDeptQuerySchema, SysDeptPageQuerySchema } from "#shared/system/department";

const p = crudPermissionProcedures('system:dept')

export const sysDeptRouter = router({
    create: p.add.input(SysDeptAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysDeptService(ctx).create(input)
        }),
    remove: p.del.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysDeptService(ctx).remove(input)
        }),
    batchDelete: p.del.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysDeptService(ctx).batchRemove(input)
        }),
    update: p.edit.input(SysDeptUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysDeptService(ctx).updateById(input.id, input)
        }),
    getOne: p.list.input(SysDeptQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysDeptService(ctx).getOne(input)
        }),
    getById: p.list.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysDeptService(ctx).getById(input)
        }),
    page: p.list.input(SysDeptPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysDeptService(ctx).page(input)
        })
})
