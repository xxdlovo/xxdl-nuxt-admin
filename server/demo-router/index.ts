//#server/demo-router
import z from 'zod'
import { proc, router } from '~~/server/trpc/init'
import { DemoAddSchema, DemoUpdateSchema, DemoQuerySchema, DemoPageQuerySchema } from '#shared/demo'
import { demoService } from './DemoService'

export const demoRouter = router({
    create: proc({ permission: 'demo:add' }).input(DemoAddSchema)
        .mutation(async ({ ctx, input }) => {
            return demoService(ctx).create(input)
        }),
    remove: proc({ permission: 'demo:del' }).input(z.string())
        .mutation(async ({ ctx, input }) => {
            return demoService(ctx).remove(input)
        }),
    batchDelete: proc({ permission: 'demo:del' }).input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return demoService(ctx).batchRemove(input)
        }),
    update: proc({ permission: 'demo:edit' }).input(DemoUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return demoService(ctx).updateById(input.id, input)
        }),
    getOne: proc({ permission: 'demo:list' }).input(DemoQuerySchema)
        .query(async ({ ctx, input }) => {
            return demoService(ctx).getOne(input)
        }),
    getById: proc({ permission: 'demo:list' }).input(z.string())
        .query(async ({ ctx, input }) => {
            return demoService(ctx).getById(input)
        }),
    page: proc({ permission: 'demo:list' }).input(DemoPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return demoService(ctx).page(input)
        })
})
