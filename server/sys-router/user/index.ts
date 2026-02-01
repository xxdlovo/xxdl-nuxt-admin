import { publicProcedure, router } from '~~/server/trpc/init'
import type { Context } from '~~/server/trpc/context'
import {sysUserService} from './SysUserService'
import z from 'zod'
import {SysUserAddSchema, SysUserPageQuerySchema, SysUserQuerySchema} from '#shared/system/user'
export const sysUserRouter = router({
    test: publicProcedure.mutation(async ({ctx}:{ctx: Context})=>{
        const get = await sysUserService(ctx).getById('1')
        console.log(get)
        return 'hello word'
    }),
    create: publicProcedure.input(SysUserAddSchema)
        .mutation(async ({ctx, input})=>{
            return sysUserService(ctx).create(input)
        }),
    remove: publicProcedure.input(z.string())
        .mutation(async ({ctx, input})=>{
            return sysUserService(ctx).remove(input)
        }),
    update: publicProcedure.input(SysUserAddSchema)
        .mutation(async ({ctx, input})=>{
            return sysUserService(ctx).updateById(input.id, input)
        }),
    getOne: publicProcedure.input(SysUserQuerySchema)
        .query(async ({ctx, input})=>{
            return sysUserService(ctx).getOne(input)
        }),
    getById: publicProcedure.input(z.string())
        .query(async ({ctx, input})=>{
            return sysUserService(ctx).getById(input)
        }),
    page: publicProcedure.input(SysUserPageQuerySchema)
        .query(async ({ctx, input})=>{
            return sysUserService(ctx).page(input)
        })

})
