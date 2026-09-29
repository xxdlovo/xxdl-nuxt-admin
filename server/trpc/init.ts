import { initTRPC } from '@trpc/server'
import type { Context } from './context'
import { errorFormatter } from './errorFormatter'
import { loggerMiddleware } from './middlewares/logger'
import { authMiddleware } from './middlewares/auth'
import { permissionMiddleware } from './middlewares/permission'
import { demoReadonlyMiddleware } from './middlewares/demo'
import { dataScopeMiddleware } from './middlewares/dataScope'
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
 * demo 模式开关。
 *
 * runtimeConfig.demoMode 同样来自 NUXT_DEMO_MODE，这里直接判断环境变量，
 * 只需在启动时求值一次，避免每个 readonly 接口在运行时重复解析配置。
 */
const demoMode = process.env.NUXT_DEMO_MODE === 'true'

/**
 * proc() 的统一声明参数。
 */
export type ProcOptions = {
  /** 权限码。不传表示仅需登录，等价于 protectedProcedure。 */
  permission?: string
  /**
   * 是否记录操作日志，默认 true。
   * 显式传入 false 可跳过日志，适用于噪音较大的接口。
   */
  log?: boolean
  /** 是否应用数据权限，默认 true；false 表示该接口不做数据范围限制。 */
  dataScope?: boolean
  /** 是否禁止在 demo 模式下调用变更操作，默认 false。通过 NUXT_DEMO_MODE 环境变量获取。 */
  readonly?: boolean
}

/**
 * 统一的 procedure 工厂，所有 router 接口都通过它声明，
 * 把「登录 / 权限 / 数据权限 / demo 只读 / 日志」收敛成一组参数。
 *
 * @example
 * create: proc({ permission: 'demo:add', readonly: true })
 *   .input(DemoAddSchema)
 *   .mutation(({ ctx, input }) => demoService(ctx).create(input))
 */
export const proc = (options: ProcOptions = {}) =>
  protectedProcedure
    .use(permissionMiddleware(options.permission))
    .use(demoReadonlyMiddleware(options.readonly === true && demoMode))
    .use(dataScopeMiddleware(options.dataScope !== false))
    .meta({ log: options.log})

/**
 * Creates the standard CRUD permission procedures for one resource.
 * list is used for page/getOne/getById, add for create, edit for update, del for remove/batchDelete.
 */
export const crudPermissionProcedures = (
  resourceCode: string
): CrudPermissionProcedures<ReturnType<typeof proc>> => {
  const permissions = crudPermissionCodes(resourceCode)

  return {
    list: proc({ permission: permissions.list }),
    add: proc({ permission: permissions.add }),
    edit: proc({ permission: permissions.edit, readonly: true }),
    del: proc({ permission: permissions.del, readonly: true })
  }
}

export const customProcedure = t.procedure.use(async (opts) => {
  return opts.next()
})
