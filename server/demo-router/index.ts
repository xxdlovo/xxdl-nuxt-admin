//#server/demo-router
import { router, crudPermissionProcedures } from '~~/server/trpc/init'
import {demoService} from './DemoService'
import z from 'zod'
import  {DemoAddSchema,DemoUpdateSchema, DemoQuerySchema,DemoPageQuerySchema} from "#shared/demo";
const p = crudPermissionProcedures('demo')
export const demoRouter = router({
    create: p.add.input(DemoAddSchema)
        .mutation(async ({ctx, input})=>{
            return demoService(ctx).create(input)
        }),
    remove: p.del.input(z.string())
        .mutation(async ({ctx, input})=>{
            return demoService(ctx).remove(input)
        }),
    batchDelete: p.del.input(z.array(z.string()))
        .mutation(async ({ctx, input})=>{
            return demoService(ctx).batchRemove(input)
        }),
    update: p.edit.input(DemoUpdateSchema)
        .mutation(async ({ctx, input})=>{
            return demoService(ctx).updateById(input.id, input)
        }),
    getOne: p.list.input(DemoQuerySchema)
        .query(async ({ctx, input})=>{
            return demoService(ctx).getOne(input)
        }),
    getById: p.list.input(z.string())
        .query(async ({ctx, input})=>{
            return demoService(ctx).getById(input)
        }),
    page: p.list.input(DemoPageQuerySchema)
        .query(async ({ctx, input})=>{
            return demoService(ctx).page(input)
        })

})
