import { and, asc, eq } from "drizzle-orm";
import { CommonRepo } from "#server/drizzle/CommonRepo";
import type { Context } from "#server/trpc/context";
import { SysDictDataBaseSchema } from "#shared/system/dictData/common";
import { sysDictData, sysDictType } from "~~/server/drizzle/schema";

const baseRepo = CommonRepo(sysDictData, SysDictDataBaseSchema)

export function sysDictDataRepo(ctx: Context) {
    const repo = baseRepo(ctx)

    return {
        ...repo,
        async listByTypeCode(code: string) {
            return ctx.db
                .select({
                    id: sysDictData.id,
                    typeId: sysDictData.typeId,
                    label: sysDictData.label,
                    i18nKey: sysDictData.i18nKey,
                    listClass: sysDictData.listClass,
                    value: sysDictData.value,
                    sortOrder: sysDictData.sortOrder,
                    status: sysDictData.status,
                    remark: sysDictData.remark,
                    createdBy: sysDictData.createdBy,
                    createdAt: sysDictData.createdAt,
                    updatedBy: sysDictData.updatedBy,
                    updatedAt: sysDictData.updatedAt,
                    isDeleted: sysDictData.isDeleted
                })
                .from(sysDictData)
                .innerJoin(sysDictType, eq(sysDictData.typeId, sysDictType.id))
                .where(and(
                    eq(sysDictType.code, code),
                    eq(sysDictType.status, 1),
                    eq(sysDictType.isDeleted, 0),
                    eq(sysDictData.status, 1),
                    eq(sysDictData.isDeleted, 0)
                ))
                .orderBy(asc(sysDictData.sortOrder))
        }
    }
}
