//#admin/server/sys-router/user
import { router, proc } from '#admin/server/trpc/init'
import { sysUserService } from './SysUserService'
import z from 'zod'
import { SysUserAddSchema, SysUserPageQuerySchema, SysUserQuerySchema, SysUserResetPasswordSchema, SysUserUpdateSchema } from '#admin/shared/system/user'
import { SysUserRoleAssignSchema, SysUserRoleAssignedIdsQuerySchema } from '#admin/shared/system/userRole'

const listProc = proc({ permission: 'system:user:list' })
const addProc = proc({ permission: 'system:user:add', repeatSubmit: true })
const editProc = proc({ permission: 'system:user:edit', repeatSubmit: true })
const delProc = proc({ permission: 'system:user:del' })

export const sysUserRouter = router({
    create: addProc.input(SysUserAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysUserService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysUserService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysUserService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysUserUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysUserService(ctx).updateById(input.id, input)
        }),
    resetPassword: proc({ permission: 'system:user:reset' }).input(SysUserResetPasswordSchema)
        .mutation(async ({ ctx, input }) => {
            return sysUserService(ctx).resetPassword(input)
        }),
    unlock: proc({ permission: 'system:user:unlock' }).input(z.string().min(1, 'form.id.required'))
        .mutation(async ({ ctx, input }) => {
            return sysUserService(ctx).unlock(input)
        }),
    getOne: listProc.input(SysUserQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysUserService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysUserService(ctx).getById(input)
        }),
    assignedRoleIds: proc({ permission: 'system:user:asrole' }).input(SysUserRoleAssignedIdsQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysUserService(ctx).listAssignedRoleIds(input)
        }),
    assignRoles: proc({ permission: 'system:user:asrole' }).input(SysUserRoleAssignSchema)
        .mutation(async ({ ctx, input }) => {
            return sysUserService(ctx).assignRoles(input)
        }),
    page: listProc.input(SysUserPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysUserService(ctx).page(input)
        })
})
