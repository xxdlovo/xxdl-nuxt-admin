//#server/sys-router/userRole
import { router, proc } from '~~/server/trpc/init'
import { sysUserRoleService } from './SysUserRoleService'
import z from 'zod'
import { SysUserRoleAddSchema, SysUserRoleUpdateSchema, SysUserRoleQuerySchema, SysUserRolePageQuerySchema } from '#shared/system/userRole'

const listProc = proc({ permission: 'system:userRole:list' })
const addProc = proc({ permission: 'system:userRole:add' })
const editProc = proc({ permission: 'system:userRole:edit' })
const delProc = proc({ permission: 'system:userRole:del' })

export const sysUserRoleRouter = router({
    create: addProc.input(SysUserRoleAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysUserRoleUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysUserRoleQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).getById(input)
        }),
    page: listProc.input(SysUserRolePageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).page(input)
        })
})
