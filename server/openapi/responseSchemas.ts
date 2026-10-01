import { z } from 'zod'
import { TrpcPageResponseSchema } from '#shared/types/common'
import { DemoRespSchema } from '#shared/demo'
import { SysUserRespSchema } from '#shared/system/user'
import { SysDeptRespSchema } from '#shared/system/department'
import { SysRoleRespSchema } from '#shared/system/role'
import { SysMenuRespSchema } from '#shared/system/menu'
import { SysConfigRespSchema } from '#shared/system/config'
import { SysDictTypeRespSchema } from '#shared/system/dictType'
import { SysDictDataRespSchema } from '#shared/system/dictData'
import { SysNoticeRespSchema } from '#shared/system/notice'
import { SysJobHandlerRespSchema, SysJobRespSchema } from '#shared/system/job'
import { SysJobLogRespSchema } from '#shared/system/jobLog'
import { SysLoginLogRespSchema } from '#shared/system/loginLog'
import { SysLogRespSchema } from '#shared/system/SysLog'
import { SysOauthAccountRespSchema } from '#shared/system/oauthAccount'
import { SysOauthConfigRespSchema, SysOauthEnabledPlatformSchema } from '#shared/system/oauthConfig'
import { SysOssRespSchema } from '#shared/system/oss'
import { SysOssConfigRespSchema } from '#shared/system/ossConfig'
import { SysRoleMenuRespSchema } from '#shared/system/roleMenu'
import { SysUserRoleRespSchema } from '#shared/system/userRole'

/**
 * 200 响应的推断规则。
 *
 * 背景：tRPC 的 procedure 都是 `return xxxService(ctx).方法(input)`，
 * 运行时只有一个 Promise，TypeScript 类型已被擦除，无法反射出响应结构；
 * Service 层的 `page` 返回 `OrmPageResp`，其 `list` 还是 `any[]`，
 * 纯类型反推同样拿不到元素结构。
 *
 * 因此这里用「命名约定 + shared 层已有 Zod 响应契约」推断：
 * - shared/<模块>/output.ts 里的 `*RespSchema` 是运行时可用的 Zod 对象（项目既定的响应契约）；
 * - procedure 名固定为 page / getOne / getById / list / create / update / remove / batchDelete，
 *   响应形状由方法名决定；
 * - 少量非标准方法在 specialResponses 里逐条登记，来源标注为 special；
 * - 无法推断的接口降级为「仅描述」，并计入 x-openapi-response-coverage.missing。
 *
 * 注意：推断结果是「少字段」而非错字段。例如用户列表走 `pageWithDept`，
 * 真实响应多出 `deptName`，而 SysUserRespSchema 没有该字段。
 * 需要精确描述时，用 procedure 级 meta 覆盖：
 *   proc(...).meta({ openapi: { responseSchema: XxxSchema } })
 */

export type ResponseInferenceSource = 'rule' | 'special' | 'none'

export type ResponseInference = {
    schema?: z.ZodType
    source: ResponseInferenceSource
    /** 说明为何没能推断出来，写入 x-openapi-response-coverage.missing */
    note?: string
}

/** router 名 → 该模块响应实体 schema */
const itemSchemaByRouter: Record<string, z.ZodType> = {
    demo: DemoRespSchema,
    sysUser: SysUserRespSchema,
    sysDept: SysDeptRespSchema,
    sysRole: SysRoleRespSchema,
    sysMenu: SysMenuRespSchema,
    sysConfig: SysConfigRespSchema,
    sysDictType: SysDictTypeRespSchema,
    sysDictData: SysDictDataRespSchema,
    sysNotice: SysNoticeRespSchema,
    sysJob: SysJobRespSchema,
    sysJobLog: SysJobLogRespSchema,
    sysLoginLog: SysLoginLogRespSchema,
    systemLog: SysLogRespSchema,
    sysOauthAccount: SysOauthAccountRespSchema,
    sysOauthConfig: SysOauthConfigRespSchema,
    sysOss: SysOssRespSchema,
    sysOssConfig: SysOssConfigRespSchema,
    sysRoleMenu: SysRoleMenuRespSchema,
    sysUserRole: SysUserRoleRespSchema
}

/** AuthUser（server/trpc/context.ts）的 Zod 镜像；该类型只有 TS 定义，没有运行时 schema。 */
const sessionUserSchema = z.object({
    id: z.string(),
    username: z.string(),
    email: z.string().nullish(),
    nickname: z.string().nullish(),
    avatar: z.string().nullish(),
    phone: z.string().nullish(),
    gender: z.number().nullish(),
    deptId: z.string().nullish(),
    isAdmin: z.number().nullish()
})

/** MyOauthBinding（SysOauthAccountService）的 Zod 镜像。 */
const myOauthBindingSchema = z.object({
    id: z.string(),
    provider: z.string(),
    providerLogin: z.string().nullable(),
    avatar: z.string().nullable(),
    createdAt: z.string().nullable()
})

/** Nitro storage 条目（SysStorageService 的 Entry）。 */
const storageEntrySchema = z.object({
    key: z.string(),
    valueType: z.string(),
    size: z.number(),
    updatedAt: z.string().nullable(),
    previewable: z.boolean()
})

const specialResponses: Record<string, z.ZodType> = {
    // 读取类接口
    'sysConfig.getValueByKey': z.string().nullable(),
    'sysDictData.listByTypeCode': z.array(SysDictDataRespSchema),
    'sysNotice.latest': z.array(SysNoticeRespSchema),
    'sysOauthConfig.enabledPlatforms': z.array(SysOauthEnabledPlatformSchema),
    'sysJob.availableHandlers': z.array(SysJobHandlerRespSchema),
    'sysRole.assignableMenus': z.array(SysMenuRespSchema),
    'sysRole.assignedMenuIds': z.array(z.string()),
    'sysUser.assignedRoleIds': z.array(z.string()),
    'sysOauthAccount.myBindings': z.array(myOauthBindingSchema),
    'sysOss.uploadConfigs': z.array(z.object({
        id: z.string().nullable(),
        configName: z.string().nullable(),
        service: z.string().nullable(),
        bucketName: z.string().nullable(),
        domain: z.string().nullable(),
        isDefault: z.number().nullable()
    })),
    'sysStorage.list': z.object({
        list: z.array(storageEntrySchema),
        page: z.number(),
        pageSize: z.number(),
        total: z.number()
    }),
    'sysStorage.get': z.object({
        key: z.string(),
        valueType: z.string(),
        size: z.number(),
        updatedAt: z.string().nullable(),
        previewable: z.boolean(),
        preview: z.unknown(),
        mimeType: z.string().nullable()
    }),

    // 状态变更类接口（Service 声明为 Promise<boolean>，但方法名不在通用规则里）
    'sysJob.enable': z.boolean(),
    'sysJob.disable': z.boolean(),
    'sysRole.updateDataScope': z.boolean(),
    'sysRole.assignMenus': z.boolean(),
    'sysUser.resetPassword': z.boolean(),
    'sysUser.assignRoles': z.boolean(),
    'sysNotice.updatePublishStatus': z.boolean(),
    'sysOauthAccount.removeMyBinding': z.boolean(),
    'sysStorage.remove': z.boolean(),
    'sysOssConfig.verify': z.object({ success: z.boolean(), message: z.string() }),

    // 例外：SysMenuService.create 返回新建菜单 id（其余模块 create 返回 boolean）
    'sysMenu.create': z.string(),
    // 调试接口，返回固定字符串，上线前应删除
    'sysUser.test': z.string(),

    // auth 模块没有 shared 响应契约，按会话用户结构镜像
    'auth.login': sessionUserSchema,
    'auth.me': sessionUserSchema.nullable(),
    'auth.updateProfile': sessionUserSchema,
    'auth.myProfile': sessionUserSchema.extend({ hasPassword: z.boolean() }),
    'auth.register': z.boolean(),
    'auth.logout': z.boolean(),
    'auth.changePassword': z.boolean(),
    'auth.setPassword': z.boolean()
}

export function inferResponseSchema(routerName: string, procedureName: string): ResponseInference {
    const key = `${routerName}.${procedureName}`
    const special = specialResponses[key]

    if (special) {
        return { schema: special, source: 'special' }
    }

    const itemSchema = itemSchemaByRouter[routerName]

    switch (procedureName) {
        case 'page':
            return itemSchema
                ? { schema: TrpcPageResponseSchema(itemSchema), source: 'rule' }
                : { source: 'none', note: `${key}: no response schema for router "${routerName}"` }
        case 'getOne':
        case 'getById':
            return itemSchema
                ? { schema: itemSchema, source: 'rule' }
                : { source: 'none', note: `${key}: no response schema for router "${routerName}"` }
        case 'list':
            return itemSchema
                ? { schema: z.array(itemSchema), source: 'rule' }
                : { source: 'none', note: `${key}: no response schema for router "${routerName}"` }
        case 'create':
        case 'remove':
        case 'update':
            return { schema: z.boolean(), source: 'rule' }
        case 'batchDelete':
            return { schema: z.number(), source: 'rule' }
        default:
            return { source: 'none', note: `${key}: not covered by response rules or specialResponses` }
    }
}

/** 供测试与文档引用，避免规则表漂移。 */
export const responseSchemaRules = {
    itemSchemaByRouter,
    specialResponses
}
