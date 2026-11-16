import { createContext } from '#admin/server/trpc/context'
import { requirePermission } from '#admin/server/utils/routeGuard'
import { AppError } from '#admin/server/utils/appError'
import { apiOperationLog } from '#admin/server/utils/apiOperationLog'
import { createApiRouteError } from '#admin/server/utils/apiRouteError'
import { createServerT } from '#admin/server/utils/serverI18n'
import { parseExcelBuffer } from '#admin/server/utils/excel'
import { sysUserService } from '#admin/server/sys-router/user/SysUserService'
import { sysUserRepo } from '#admin/server/sys-router/user/SysUserRepo'
import { sysDeptService } from '#admin/server/sys-router/dept/SysDeptService'

/**
 * 用户 Excel 导入。
 *
 * 逐行校验，部分成功：合法行入库，非法行返回行号与原因。
 * 密码为空时使用默认密码 123456，导入后应提示用户尽快修改。
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024
const DEFAULT_PASSWORD = '123456'

function getMultipartField(parts: Awaited<ReturnType<typeof readMultipartFormData>>, name: string) {
    return parts?.find(part => part.name === name)
}

function normalizeGender(value: string) {
    const text = value.trim().toLowerCase()
    if (!text || text === '0' || text === '未知' || text === 'unknown') return 0
    if (text === '1' || text === '男' || text === 'male') return 1
    if (text === '2' || text === '女' || text === 'female') return 2
    return null
}

function normalizeStatus(value: string) {
    const text = value.trim().toLowerCase()
    if (!text || text === '1' || text === '启用' || text === '正常' || text === 'enabled') return 1
    if (text === '0' || text === '禁用' || text === '停用' || text === 'disabled') return 0
    return null
}

export default defineEventHandler(async (event) => {
    const ctx = await createContext(event)
    const t = createServerT(event)
    const operationLog = apiOperationLog(ctx, 'system.excel.import')

    try {
        if (useRuntimeConfig(event).demoMode) {
            throw new AppError('system.demoReadonly')
        }

        await requirePermission(ctx, 'system:user:add')

        const parts = await readMultipartFormData(event)
        const module = getMultipartField(parts, 'module')?.data?.toString('utf8') ?? 'user'
        const filePart = getMultipartField(parts, 'file')

        if (module !== 'user') {
            throw new AppError('module.system.excel.unsupportedModule')
        }
        if (!filePart?.filename || !filePart.data?.byteLength) {
            throw new AppError('module.system.excel.fileRequired')
        }
        if (filePart.data.byteLength > MAX_FILE_SIZE) {
            throw new AppError('module.system.excel.fileTooLarge')
        }

        const parsed = await parseExcelBuffer(filePart.data)
        if (parsed.rows.length === 0) {
            throw new AppError('module.system.excel.emptyFile')
        }

        const depts = await sysDeptService(ctx).list({})
        const deptByCode = new Map(
            depts
                .filter(dept => dept.code && dept.id)
                .map(dept => [String(dept.code), dept.id as string])
        )

        const repo = sysUserRepo(ctx)
        const userService = sysUserService(ctx)
        const errors: Array<{ row: number, message: string }> = []
        let successCount = 0

        for (let index = 0; index < parsed.rows.length; index += 1) {
            const row = parsed.rows[index]!
            const rowNumber = index + 2

            try {
                const username = row['用户名']?.trim()
                const email = row['邮箱']?.trim()
                const nickname = row['昵称']?.trim() || username
                const phone = row['手机号']?.trim() || ''
                const deptCode = row['部门编码']?.trim() || ''
                const password = row['密码']?.trim() || DEFAULT_PASSWORD
                const gender = normalizeGender(row['性别'] ?? '')
                const status = normalizeStatus(row['状态'] ?? '')

                if (!username) {
                    throw new Error('用户名不能为空')
                }
                if (!email) {
                    throw new Error('邮箱不能为空')
                }
                if (gender === null) {
                    throw new Error('性别只能是 男/女/未知')
                }
                if (status === null) {
                    throw new Error('状态只能是 启用/禁用')
                }
                if (await repo.existsByUsername(username)) {
                    throw new Error('用户名已存在')
                }
                if (await repo.existsByEmail(email)) {
                    throw new Error('邮箱已存在')
                }
                if (phone && await repo.existsByPhone(phone)) {
                    throw new Error('手机号已存在')
                }

                let deptId: string | null = null
                if (deptCode) {
                    deptId = deptByCode.get(deptCode) ?? null
                    if (!deptId) {
                        throw new Error(`部门编码不存在：${deptCode}`)
                    }
                }

                await userService.create({
                    id: '',
                    username,
                    password,
                    email,
                    nickname,
                    phone,
                    gender,
                    deptId,
                    status,
                    remark: 'Excel 导入',
                    postIds: [],
                } as any)

                successCount += 1
            }
            catch (error) {
                errors.push({
                    row: rowNumber,
                    message: error instanceof Error ? error.message : String(error),
                })
            }
        }

        await operationLog.success({
            requestParams: {
                module,
                fileName: filePart.filename,
                total: parsed.rows.length,
                successCount,
                failedCount: errors.length,
            },
            requestResult: { successCount, failedCount: errors.length },
        })

        return {
            success: true,
            data: {
                total: parsed.rows.length,
                successCount,
                failedCount: errors.length,
                errors,
            },
        }
    }
    catch (error) {
        await operationLog.failure(error)
        throw createApiRouteError(error, t, 'module.system.excel.importFailed')
    }
})
