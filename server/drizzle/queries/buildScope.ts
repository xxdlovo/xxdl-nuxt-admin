import { and, eq, inArray, like, or, sql, type SQL } from "drizzle-orm"
import type { Context } from "#server/trpc/context"
import { sysDepartment, sysRole, sysUser, sysUserRole } from "#server/drizzle/schema"
import { mergeWhere } from "./mergeWhere"

// sys_role.data_scope 的取值：
// 1：全部数据权限
// 2：自定数据权限
// 3：本部门数据权限
// 4：本部门及以下数据权限
// 5：仅本人数据权限
// 6：部门及以下或本人数据权限
type DataScope = "1" | "2" | "3" | "4" | "5" | "6"

// Drizzle 的 table 对象本质上是字段集合；先判断字段是否存在，再决定能否拼对应条件。
function hasColumn(table: Record<string, unknown>, column: string) {
    return column in table
}

// 用一个永远不成立的 SQL 条件兜底，表示“当前用户没有该表的数据访问范围”。
function denyAll() {
    return sql`1 = 0`
}

// 部门范围可能来自多个角色，去重后再拼 inArray，避免重复参数。
function uniq(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)))
}

// 获取当前用户部门。优先使用 session/context 中已有的 deptId；
// 老 session 可能没有 deptId，所以这里会按用户 id 回表查询并缓存到 ctx.user。
async function getCurrentUserDeptId(ctx: Context) {
    if (!ctx.user?.id) {
        return null
    }

    if (ctx.user.deptId !== undefined) {
        return ctx.user.deptId ?? null
    }

    const rows = await ctx.db
        .select({ deptId: sysUser.deptId })
        .from(sysUser)
        .where(eq(sysUser.id, ctx.user.id))
        .limit(1)

    const deptId = rows[0]?.deptId ?? null
    ctx.user.deptId = deptId
    return deptId
}

// 获取“本部门及以下”的部门 id 集合。
// sys_department.path 存在时按 path 前缀查子部门；没有 path 时至少返回当前部门。
async function listDeptAndChildrenIds(ctx: Context, deptId: string | null) {
    if (!deptId) {
        return []
    }

    const currentDeptRows = await ctx.db
        .select({ id: sysDepartment.id, path: sysDepartment.path })
        .from(sysDepartment)
        .where(eq(sysDepartment.id, deptId))
        .limit(1)

    const currentDept = currentDeptRows[0]
    if (!currentDept?.path) {
        return [deptId]
    }

    const rows = await ctx.db
        .select({ id: sysDepartment.id })
        .from(sysDepartment)
        .where(or(
            eq(sysDepartment.id, deptId),
            like(sysDepartment.path, `${currentDept.path}%`)
        ))

    return uniq(rows.map(row => row.id))
}

// 通过 用户 -> 用户角色 -> 角色 查询当前用户拥有的数据范围。
// 只读取启用且未逻辑删除的用户角色关系和角色，保持与菜单/按钮 RBAC 的口径一致。
async function listRoleDataScopes(ctx: Context): Promise<DataScope[]> {
    if (!ctx.user?.id) {
        return []
    }

    const rows = await ctx.db
        .select({ dataScope: sysRole.dataScope })
        .from(sysUserRole)
        .innerJoin(sysRole, eq(sysUserRole.roleId, sysRole.id))
        .where(and(
            eq(sysUserRole.userId, ctx.user.id),
            eq(sysUserRole.status, 1),
            eq(sysUserRole.isDeleted, 0),
            eq(sysRole.status, 1),
            eq(sysRole.isDeleted, 0)
        ))

    return rows
        .map(row => row.dataScope)
        .filter((scope): scope is DataScope => ["1", "2", "3", "4", "5", "6"].includes(scope))
}

// data_scope=2 “自定数据权限”需要角色-部门关系表。
// 当前项目还没有 sys_role_dept 之类的表，所以这里先保留扩展点，后续只需要在这里返回授权部门 id。
async function listCustomDeptIds(_ctx: Context) {
    return []
}

// 解析当前请求的数据权限，并缓存在 ctx.dataPermission 中。
// 一个请求里可能有多个 CommonRepo 查询，缓存可以避免重复查询用户角色和部门树。
export async function resolveDataPermission(ctx: Context) {
    if (ctx.dataPermission) {
        return ctx.dataPermission
    }

    // 未登录或超级管理员不做数据范围限制。
    if (!ctx.user || ctx.user.isAdmin === 1) {
        ctx.dataPermission = {
            loaded: true,
            isAll: true,
            hasDataScope: false,
            deptIds: [],
            customDeptIds: [],
            includeSelf: false
        }
        return ctx.dataPermission
    }

    const roleScopes = await listRoleDataScopes(ctx)
    // 任意一个角色拥有“全部数据权限”，最终结果就是全部权限。
    if (roleScopes.includes("1")) {
        ctx.dataPermission = {
            loaded: true,
            isAll: true,
            hasDataScope: true,
            deptIds: [],
            customDeptIds: [],
            includeSelf: false
        }
        return ctx.dataPermission
    }

    const currentDeptId = await getCurrentUserDeptId(ctx)
    const deptIds: string[] = []
    // 3：只包含当前用户所在部门。
    const needsOwnDept = roleScopes.includes("3")
    // 4 / 6：包含当前用户所在部门及所有下级部门。
    const needsDeptTree = roleScopes.includes("4") || roleScopes.includes("6")
    // 2：自定义部门集合，当前先通过扩展点获取。
    const needsCustomDept = roleScopes.includes("2")

    if (needsOwnDept && currentDeptId) {
        deptIds.push(currentDeptId)
    }
    if (needsDeptTree) {
        deptIds.push(...await listDeptAndChildrenIds(ctx, currentDeptId))
    }

    const customDeptIds = needsCustomDept ? await listCustomDeptIds(ctx) : []

    ctx.dataPermission = {
        loaded: true,
        isAll: false,
        hasDataScope: roleScopes.length > 0,
        deptIds: uniq([...deptIds, ...customDeptIds]),
        customDeptIds,
        // 5 / 6 都需要额外拼“本人数据”条件。
        includeSelf: roleScopes.includes("5") || roleScopes.includes("6")
    }
    return ctx.dataPermission
}

// 根据授权部门 id 拼部门条件。
// 普通业务表优先用 deptId 字段；部门表本身没有 deptId，所以用部门表 id 限制可见部门。
function buildDeptScope(table: any, deptIds: string[]) {
    if (deptIds.length === 0) {
        return null
    }

    if (hasColumn(table, "deptId")) {
        return inArray(table.deptId, deptIds)
    }

    if (table === sysDepartment && hasColumn(table, "id")) {
        return inArray(table.id, deptIds)
    }

    return null
}

// 拼“本人数据”条件。
// sys_user 表的“本人”是用户 id；业务关系表优先用 userId；普通业务表则退回 createdBy。
function buildSelfScope(table: any, userId: string | undefined) {
    if (!userId) {
        return null
    }

    if (table === sysUser && hasColumn(table, "id")) {
        return eq(table.id, userId)
    }

    if (hasColumn(table, "userId")) {
        return eq(table.userId, userId)
    }

    if (hasColumn(table, "createdBy")) {
        return eq(table.createdBy, userId)
    }

    return null
}

// 构建 CommonRepo 默认 scope：
// 1. 自动拼逻辑删除条件；
// 2. 按当前用户角色解析数据权限；
// 3. 把部门范围和本人范围用 OR 合并后再交给外层 where。
export async function buildScope(table: any, ctx: Context): Promise<SQL[]> {
    const conditions: SQL[] = []

    if (hasColumn(table, "isDeleted")) {
        conditions.push(eq(table.isDeleted, 0))
    }

    const permission = await resolveDataPermission(ctx)
    // 全部权限或没有配置数据范围时，只保留基础条件，不额外限制。
    if (permission.isAll || !permission.hasDataScope) {
        return conditions
    }

    const scopeConditions = [
        buildDeptScope(table, permission.deptIds),
        permission.includeSelf ? buildSelfScope(table, ctx.user?.id) : null
    ].filter(Boolean) as SQL[]

    if (scopeConditions.length > 0) {
        conditions.push(or(...scopeConditions)!)
    } else if (hasColumn(table, "deptId") || hasColumn(table, "userId") || hasColumn(table, "createdBy") || table === sysDepartment || table === sysUser) {
        // 表具备可控字段，但当前用户没有任何可用范围时，返回空结果。
        conditions.push(denyAll())
    }

    return conditions
}

// 给手写 SQL / 自定义 repo 使用的统一 where 包装方法。
// extraWhere 是业务条件，buildScope 是系统条件，最终通过 AND 合并。
export async function buildScopedWhere(table: any, ctx: Context, ...extraWhere: (SQL | undefined)[]) {
    return mergeWhere(
        ...await buildScope(table, ctx),
        ...extraWhere
    )
}
