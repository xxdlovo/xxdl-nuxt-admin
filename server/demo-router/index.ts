//#server/demo-router
import { router,protectedProcedure } from '~~/server/trpc/init'
import {demoService} from './DemoService'
import z from 'zod'
import  {DemoAddSchema,DemoUpdateSchema, DemoQuerySchema,DemoPageQuerySchema} from "#shared/demo";
export const demoRouter = router({
    create: protectedProcedure.input(DemoAddSchema)
        .mutation(async ({ctx, input})=>{
            return demoService(ctx).create(input)
        }),
    remove: protectedProcedure.input(z.string())
        .mutation(async ({ctx, input})=>{
            return demoService(ctx).remove(input)
        }),
    batchDelete: protectedProcedure.input(z.array(z.string()))
        .mutation(async ({ctx, input})=>{
            return demoService(ctx).batchRemove(input)
        }),
    update: protectedProcedure.input(DemoUpdateSchema)
        .mutation(async ({ctx, input})=>{
            return demoService(ctx).updateById(input.id, input)
        }),
    getOne: protectedProcedure.input(DemoQuerySchema)
        .query(async ({ctx, input})=>{
            return demoService(ctx).getOne(input)
        }),
    getById: protectedProcedure.input(z.string())
        .query(async ({ctx, input})=>{
            return demoService(ctx).getById(input)
        }),
    page: protectedProcedure.input(DemoPageQuerySchema)
        .query(async ({ctx, input})=>{
            return demoService(ctx).page(input)
        })

})
