import { CommonRepo } from "#server/drizzle/CommonRepo";
import { SysDeptBaseSchema } from "#shared/system/department/common";
import { sysDepartment } from "~~/server/drizzle/schema";
import { and, asc, eq, isNull, or, type SQL } from "drizzle-orm";
import type { Context } from "#server/trpc/context";

const commonRepo = CommonRepo(sysDepartment, SysDeptBaseSchema)

export const sysDeptRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    /** 部门是否存在且未软删（用户保存前校验 deptId） */
    async existsActiveById(id: string) {
      const rows = await ctx.db
        .select({ id: sysDepartment.id })
        .from(sysDepartment)
        .where(and(eq(sysDepartment.id, id), eq(sysDepartment.isDeleted, 0)))
        .limit(1)

      return Boolean(rows[0])
    },

    /**
     * 部门分页：parentId === '0' 表示查根节点（库里 '0' / '' / NULL 三种写法并存），
     * 指定其他 parentId 则查该父级下的直接子节点；按 sortOrder 升序。
     */
    async pageByParent(page: number, pageSize: number, dto: Record<string, unknown>, parentId?: string | null) {
      const extraWhere: SQL[] = []

      if (parentId === '0') {
        const rootParentWhere = or(
          eq(sysDepartment.parentId, '0'),
          eq(sysDepartment.parentId, ''),
          isNull(sysDepartment.parentId)
        )

        if (rootParentWhere) {
          extraWhere.push(rootParentWhere)
        }
      } else if (parentId) {
        extraWhere.push(eq(sysDepartment.parentId, parentId))
      }

      return await repo.page(page, pageSize, dto, [asc(sysDepartment.sortOrder)], extraWhere)
    }
  }
}
