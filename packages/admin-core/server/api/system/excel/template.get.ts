import { createContext } from '#admin/server/trpc/context'
import { requirePermission } from '#admin/server/utils/routeGuard'
import { AppError } from '#admin/server/utils/appError'
import { createApiRouteError } from '#admin/server/utils/apiRouteError'
import { createServerT } from '#admin/server/utils/serverI18n'
import { buildExcelBuffer } from '#admin/server/utils/excel'

/**
 * 用户导入模板。
 *
 * 表头必须与 import.post.ts 的解析逻辑一致；新增列时两边同时改。
 */
export default defineEventHandler(async (event) => {
    const ctx = await createContext(event)
    const t = createServerT(event)

    try {
        const query = getQuery(event)
        const module = String(query.module ?? 'user')

        if (module !== 'user') {
            throw new AppError('module.system.excel.unsupportedModule')
        }

        await requirePermission(ctx, 'system:user:add')

        const buffer = await buildExcelBuffer({
            sheetName: 'users',
            columns: [
                { header: '用户名', key: 'username', width: 22 },
                { header: '昵称', key: 'nickname', width: 20 },
                { header: '邮箱', key: 'email', width: 30 },
                { header: '手机号', key: 'phone', width: 18 },
                { header: '性别', key: 'gender', width: 10 },
                { header: '状态', key: 'status', width: 10 },
                { header: '部门编码', key: 'deptCode', width: 20 },
                { header: '密码', key: 'password', width: 20 },
            ],
            rows: [],
        })

        setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        setHeader(event, 'Content-Disposition', 'attachment; filename="user-import-template.xlsx"')

        return buffer
    }
    catch (error) {
        throw createApiRouteError(error, t, 'module.system.excel.templateFailed')
    }
})
