//#server/sys-router/user
import { publicProcedure, router,protectedProcedure } from '~~/server/trpc/init'
import type { Context } from '~~/server/trpc/context'
import {sysUserService} from './SysUserService'
import z from 'zod'
import {SysUserAddSchema, SysUserPageQuerySchema, SysUserQuerySchema, SysUserUpdateSchema} from '#shared/system/user'
export const sysUserRouter = router({
    test: publicProcedure.mutation(async ({ctx}:{ctx: Context})=>{
        const get = await sysUserService(ctx).getById('1')
        // console.log(get)
        return 'hello word'
    }),
    create: protectedProcedure.input(SysUserAddSchema)
        .mutation(async ({ctx, input})=>{
            // console.log('后端收到:',input)
            // return true
            return sysUserService(ctx).create(input)
        }),
    remove: protectedProcedure.input(z.string())
        .mutation(async ({ctx, input})=>{
            return sysUserService(ctx).remove(input)
        }),
    update: protectedProcedure.input(SysUserUpdateSchema)
        .mutation(async ({ctx, input})=>{
            return sysUserService(ctx).updateById(input.id, input)
        }),
    getOne: protectedProcedure.input(SysUserQuerySchema)
        .query(async ({ctx, input})=>{
            return sysUserService(ctx).getOne(input)
        }),
    getById: protectedProcedure.input(z.string())
        .query(async ({ctx, input})=>{
            return sysUserService(ctx).getById(input)
        }),
    page: protectedProcedure.input(SysUserPageQuerySchema)
        .query(async ({ctx, input})=>{
            return sysUserService(ctx).page(input)
        })

})
