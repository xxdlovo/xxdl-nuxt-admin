import { createContext } from '#admin/server/trpc/context'
import { requirePermission } from '#admin/server/utils/routeGuard'
import { AppError } from '#admin/server/utils/appError'
import { apiOperationLog } from '#admin/server/utils/apiOperationLog'
import { createApiRouteError } from '#admin/server/utils/apiRouteError'
import { createServerT } from '#admin/server/utils/serverI18n'
import { buildExcelBuffer, buildExcelFilename, type ExcelColumn, type ExcelRow } from '#admin/server/utils/excel'
import { sysUserService } from '#admin/server/sys-router/user/SysUserService'
import { sysRoleService } from '#admin/server/sys-router/role/SysRoleService'
import { sysPostService } from '#admin/server/sys-router/post/SysPostService'
import { sysSystemLogService } from '#admin/server/sys-router/systemLog/SysSystemLogService'
import { sysLoginLogService } from '#admin/server/sys-router/loginLog/SysLoginLogService'
import { sysJobLogService } from '#admin/server/sys-router/jobLog/SysJobLogService'

/**
 * 系统列表 Excel 导出。
 *
 * 统一入口，按 module 分发到各模块 service，沿用 service 内的数据权限。
 * 首批支持：用户、角色、岗位、操作日志、登录日志。
 */

const EXPORT_LIMIT = 10_000

const MODULE_PERMISSIONS: Record<string, string> = {
    user: 'system:user:list',
    role: 'system:role:list',
    post: 'system:post:list',
    systemLog: 'system:systemLog:list',
    loginLog: 'system:loginLog:list',
    jobLog: 'system:jobLog:list',
}

const MODULE_FILENAMES: Record<string, string> = {
    user: 'users',
    role: 'roles',
    post: 'posts',
    systemLog: 'system-logs',
    loginLog: 'login-logs',
    jobLog: 'job-logs',
}

function statusText(value: unknown) {
    return Number(value) === 1 ? '启用' : '禁用'
}

function genderText(value: unknown) {
    return Number(value) === 1 ? '男' : Number(value) === 2 ? '女' : '未知'
}

type ModuleConfig = {
    columns: ExcelColumn[]
    rows: ExcelRow[]
}

async function loadModule(ctx: any, module: string, filters: Record<string, unknown>): Promise<ModuleConfig> {
    switch (module) {
        case 'user': {
            const users = await sysUserService(ctx).list(filters) as any[]
            return {
                columns: [
                    { header: '用户名', key: 'username', width: 20 },
                    { header: '昵称', key: 'nickname', width: 20 },
                    { header: '邮箱', key: 'email', width: 28 },
                    { header: '手机号', key: 'phone', width: 18 },
                    { header: '性别', key: 'genderText', width: 10 },
                    { header: '部门', key: 'deptName', width: 20 },
                    { header: '岗位', key: 'postNames', width: 24 },
                    { header: '状态', key: 'statusText', width: 10 },
                    { header: '创建时间', key: 'createdAt', width: 22 },
                ],
                rows: users.map(user => ({
                    ...user,
                    genderText: genderText(user.gender),
                    statusText: statusText(user.status),
                })),
            }
        }
        case 'role': {
            const roles = await sysRoleService(ctx).list(filters) as any[]
            return {
                columns: [
                    { header: '角色名称', key: 'name', width: 20 },
                    { header: '角色编码', key: 'code', width: 20 },
                    { header: '数据范围', key: 'dataScope', width: 12 },
                    { header: '描述', key: 'description', width: 32 },
                    { header: '排序', key: 'sortOrder', width: 10 },
                    { header: '状态', key: 'statusText', width: 10 },
                    { header: '创建时间', key: 'createdAt', width: 22 },
                ],
                rows: roles.map(role => ({
                    ...role,
                    statusText: statusText(role.status),
                })),
            }
        }
        case 'post': {
            const posts = await sysPostService(ctx).list(filters) as any[]
            return {
                columns: [
                    { header: '岗位编码', key: 'code', width: 20 },
                    { header: '岗位名称', key: 'name', width: 20 },
                    { header: '排序', key: 'sortOrder', width: 10 },
                    { header: '状态', key: 'statusText', width: 10 },
                    { header: '备注', key: 'remark', width: 32 },
                ],
                rows: posts.map(post => ({
                    ...post,
                    statusText: statusText(post.status),
                })),
            }
        }
        case 'systemLog': {
            const logs = await sysSystemLogService(ctx).list(filters) as any[]
            return {
                columns: [
                    { header: '级别', key: 'level', width: 10 },
                    { header: '模块', key: 'module', width: 22 },
                    { header: '消息', key: 'message', width: 40 },
                    { header: '操作人', key: 'username', width: 18 },
                    { header: 'IP', key: 'ip', width: 18 },
                    { header: '请求路径', key: 'requestPath', width: 36 },
                    { header: '状态', key: 'statusText', width: 10 },
                    { header: '耗时(ms)', key: 'durationMs', width: 12 },
                    { header: '时间', key: 'createdAt', width: 22 },
                ],
                rows: logs.map(log => ({
                    ...log,
                    statusText: statusText(log.status),
                })),
            }
        }
        case 'loginLog': {
            const logs = await sysLoginLogService(ctx).list(filters) as any[]
            return {
                columns: [
                    { header: '用户名', key: 'username', width: 20 },
                    { header: 'IP', key: 'ip', width: 18 },
                    { header: '地点', key: 'location', width: 20 },
                    { header: '浏览器', key: 'browser', width: 16 },
                    { header: '操作系统', key: 'os', width: 16 },
                    { header: '状态', key: 'statusText', width: 10 },
                    { header: '登录时间', key: 'loginTime', width: 22 },
                ],
                rows: logs.map(log => ({
                    ...log,
                    statusText: statusText(log.status),
                })),
            }
        }
        case 'jobLog': {
            const logs = await sysJobLogService(ctx).list(filters) as any[]
            return {
                columns: [
                    { header: '任务名称', key: 'jobName', width: 24 },
                    { header: '任务编码', key: 'jobCode', width: 22 },
                    { header: '处理器', key: 'handlerCode', width: 22 },
                    { header: '触发方式', key: 'triggerText', width: 12 },
                    { header: '状态', key: 'statusText', width: 10 },
                    { header: '开始时间', key: 'startedAt', width: 22 },
                    { header: '耗时(ms)', key: 'durationMs', width: 12 },
                    { header: '错误信息', key: 'errorMessage', width: 40 },
                ],
                rows: logs.map(log => ({
                    ...log,
                    triggerText: log.triggerType === 'manual' ? '手动' : '定时',
                    statusText: Number(log.status) === 1 ? '成功' : Number(log.status) === 2 ? '失败' : '运行中',
                })),
            }
        }
        default:
            throw new AppError('module.system.excel.unsupportedModule')
    }
}

export default defineEventHandler(async (event) => {
    const ctx = await createContext(event)
    const operationLog = apiOperationLog(ctx, 'system.excel.export')

    try {
        const body = await readBody<{ module?: string, filters?: Record<string, unknown> }>(event)
        const module = String(body?.module ?? '').trim()
        const permission = MODULE_PERMISSIONS[module]

        if (!permission) {
            throw new AppError('module.system.excel.unsupportedModule')
        }

        await requirePermission(ctx, permission)

        const config = await loadModule(ctx, module, body?.filters ?? {})
        const truncated = config.rows.length > EXPORT_LIMIT
        const rows = truncated ? config.rows.slice(0, EXPORT_LIMIT) : config.rows
        const buffer = await buildExcelBuffer({
            sheetName: module,
            columns: config.columns,
            rows,
        })

        setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        setHeader(event, 'Content-Disposition', `attachment; filename="${buildExcelFilename(MODULE_FILENAMES[module] ?? module)}"`)
        setHeader(event, 'X-Export-Truncated', truncated ? '1' : '0')

        await operationLog.success({
            requestParams: { module, filters: body?.filters ?? {}, count: rows.length },
            requestResult: { count: rows.length, truncated },
        })

        return buffer
    }
    catch (error) {
        await operationLog.failure(error)
        throw createApiRouteError(error, createServerT(event), 'module.system.excel.exportFailed')
    }
})
