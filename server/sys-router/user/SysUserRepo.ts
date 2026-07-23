import { CommonRepo } from "#server/drizzle/CommonRepo"
import type { Context } from "#server/trpc/context"
import { SysUserBaseSchema } from "#shared/system/user/common"
import { and, count, eq, getTableColumns } from "drizzle-orm"
import { sysDepartment, sysUser } from "~~/server/drizzle/schema"
import { buildScopedWhere } from "#server/drizzle/queries/buildScope"
import { buildWhereBySchema } from "#server/drizzle/queries/buildWhereBySchema"

const commonRepo = CommonRepo(sysUser, SysUserBaseSchema)
const userColumns = getTableColumns(sysUser)
const userWithDeptColumns = {
  ...userColumns,
  deptName: sysDepartment.name,
  deptCode: sysDepartment.code
}

export const sysUserRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    async pageWithDept(page: number, pageSize: number, dto: any) {
      const offset = (page - 1) * pageSize
      const dynamicWhere = buildWhereBySchema(SysUserBaseSchema, sysUser, dto)
      const where = await buildScopedWhere(sysUser, ctx, ...dynamicWhere)

      const totalResult = await ctx.db
        .select({ total: count() })
        .from(sysUser)
        .where(where)

      const data = await ctx.db
        .select(userWithDeptColumns)
        .from(sysUser)
        .leftJoin(sysDepartment, and(
          eq(sysUser.deptId, sysDepartment.id),
          eq(sysDepartment.isDeleted, 0)
        ))
        .where(where)
        .limit(pageSize)
        .offset(offset)

      return {
        total: totalResult[0]?.total ?? 0,
        page,
        pageSize,
        list: data
      }
    },

    async listWithDept(dto: any = {}) {
      const dynamicWhere = buildWhereBySchema(SysUserBaseSchema, sysUser, dto)
      const where = await buildScopedWhere(sysUser, ctx, ...dynamicWhere)

      return ctx.db
        .select(userWithDeptColumns)
        .from(sysUser)
        .leftJoin(sysDepartment, and(
          eq(sysUser.deptId, sysDepartment.id),
          eq(sysDepartment.isDeleted, 0)
        ))
        .where(where)
    },

    async getOneWithDept(req: any) {
      const dynamicWhere = buildWhereBySchema(SysUserBaseSchema, sysUser, req)
      const where = await buildScopedWhere(sysUser, ctx, ...dynamicWhere)
      const data = await ctx.db
        .select(userWithDeptColumns)
        .from(sysUser)
        .leftJoin(sysDepartment, and(
          eq(sysUser.deptId, sysDepartment.id),
          eq(sysDepartment.isDeleted, 0)
        ))
        .where(where)
        .limit(1)

      return data[0] ?? null
    },

    async getByIdWithDept(id: string) {
      const data = await ctx.db
        .select(userWithDeptColumns)
        .from(sysUser)
        .leftJoin(sysDepartment, and(
          eq(sysUser.deptId, sysDepartment.id),
          eq(sysDepartment.isDeleted, 0)
        ))
        .where(await buildScopedWhere(sysUser, ctx, eq(sysUser.id, id)))
        .limit(1)

      return data[0] ?? null
    },

    async updatePasswordById(id: string, password: string) {
      await ctx.db
        .update(sysUser)
        .set({ password })
        .where(eq(sysUser.id, id))
    }
  }
}
