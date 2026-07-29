import { initTRPC } from '@trpc/server'
import type { Context } from './context'
import { errorFormatter } from './errorFormatter'
import { loggerMiddleware } from './middlewares/logger'
import { authMiddleware } from './middlewares/auth'
import { permissionMiddleware } from './middlewares/permission'
import { demoReadonlyMiddleware } from './middlewares/demo'
import { crudPermissionCodes, type CrudPermissionProcedures } from '#shared/auth'

export const t = initTRPC.context<Context>().create({
  errorFormatter
})

export const createCallerFactory = t.createCallerFactory
export const router = t.router
export const publicProcedure = t.procedure

/**
 * Requires a valid user session, but does not check business permissions.
 * Use this for APIs that only need login state, such as auth.profile.
 * 只需登录, 无需权限
 */
export const protectedProcedure = publicProcedure.use(loggerMiddleware).use(authMiddleware)

/**
 * Requires login and one explicit permission code.
 *
 * @example
 * export const sysUserRouter = router({
 *   resetPwd: permissionProcedure('system:user:resetPwd')
 *     .input(SysUserUpdatePwdSchema)
 *     .mutation(({ ctx, input }) => sysUserService(ctx).resetPwd(input))
 * })
 */
export const permissionProcedure = (permissionCode: string) =>
  protectedProcedure.use(permissionMiddleware(permissionCode))

/**
 * Creates the standard CRUD permission procedures for one resource.
 * list is used for page/getOne/getById, add for create, edit for update, del for remove/batchDelete.
 */
export const crudPermissionProcedures = (
  resourceCode: string
): CrudPermissionProcedures<ReturnType<typeof permissionProcedure>> => {
  const permissions = crudPermissionCodes(resourceCode)

  return {
    list: permissionProcedure(permissions.list),
    add: permissionProcedure(permissions.add),
    edit: permissionProcedure(permissions.edit).use(demoReadonlyMiddleware),
    del: permissionProcedure(permissions.del).use(demoReadonlyMiddleware)
  }
}

export const customProcedure = t.procedure.use(async (opts) => {
  return opts.next()
})
