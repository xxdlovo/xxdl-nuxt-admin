//#server/sys-router/user
import {publicProcedure, router, crudPermissionProcedures, permissionProcedure} from '~~/server/trpc/init'
import type { Context } from '~~/server/trpc/context'
import {sysUserService} from './SysUserService'
import z from 'zod'
import {SysUserAddSchema, SysUserPageQuerySchema, SysUserQuerySchema, SysUserResetPasswordSchema, SysUserUpdateSchema} from '#shared/system/user'
import { SysUserRoleAssignSchema, SysUserRoleAssignedIdsQuerySchema } from '#shared/system/userRole'
import {demoReadonlyMiddleware} from "#server/trpc/middlewares/demo";

const p = crudPermissionProcedures('system:user')

export const sysUserRouter = router({
    test: publicProcedure.mutation(async ({ctx}:{ctx: Context})=>{
        const get = await sysUserService(ctx).getById('1')
        // console.log(get)
        return 'hello word'
    }),
    create: p.add.input(SysUserAddSchema)
        .mutation(async ({ctx, input})=>{
            return sysUserService(ctx).create(input)
        }),
    remove: p.del.input(z.string())
        .mutation(async ({ctx, input})=>{
            return sysUserService(ctx).remove(input)
        }),
    batchDelete: p.del.input(z.array(z.string()))
        .mutation(async ({ctx, input})=>{
            return sysUserService(ctx).batchRemove(input)
        }),
    update: p.edit.input(SysUserUpdateSchema)
        .mutation(async ({ctx, input})=>{
            return sysUserService(ctx).updateById(input.id, input)
        }),
    resetPassword: permissionProcedure('system:user:reset').use(demoReadonlyMiddleware).input(SysUserResetPasswordSchema)
        .mutation(async ({ctx, input})=>{
            return sysUserService(ctx).resetPassword(input)
        }),
    getOne: p.list.input(SysUserQuerySchema)
        .query(async ({ctx, input})=>{
            return sysUserService(ctx).getOne(input)
        }),
    getById: p.list.input(z.string())
        .query(async ({ctx, input})=>{
            return sysUserService(ctx).getById(input)
        }),
    assignedRoleIds:permissionProcedure('system:user:asrole').use(demoReadonlyMiddleware).input(SysUserRoleAssignedIdsQuerySchema)
        .query(async ({ctx, input})=>{
            return sysUserService(ctx).listAssignedRoleIds(input)
        }),
    assignRoles: permissionProcedure('system:user:asrole').use(demoReadonlyMiddleware).input(SysUserRoleAssignSchema)
        .mutation(async ({ctx, input})=>{
            return sysUserService(ctx).assignRoles(input)
        }),
    page: p.list.input(SysUserPageQuerySchema)
        .query(async ({ctx, input})=>{
            return sysUserService(ctx).page(input)
        })

})
