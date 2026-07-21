import { Column, count, eq, inArray, type InferInsertModel, type SQL } from "drizzle-orm"
import { MySqlTable } from "drizzle-orm/mysql-core/table"
import { ZodObject } from "zod"
import type { Context } from "#server/trpc/context"
import { buildScopedWhere } from "./queries/buildScope"
import { buildWhereBySchema } from "./queries/buildWhereBySchema"

type TableWithId<T extends MySqlTable> = T & { id: Column<any>; isDeleted: Column<any> }
type RecordData = Record<string, unknown>

function hasColumn(table: MySqlTable, column: string) {
    return column in table
}

// Read the current operator from tRPC context; system jobs can write null.
function getOperatorId(ctx: Context) {
    return ctx.user?.id ?? null
}

// Fill audit defaults only when the target table actually has those columns.
function withCreateAudit(table: MySqlTable, ctx: Context, data: RecordData) {
    const operatorId = getOperatorId(ctx)
    const values: RecordData = { ...data }

    if (hasColumn(table, "isDeleted")) {
        values.isDeleted = 0
    }
    if (hasColumn(table, "createdBy") && values.createdBy == null) {
        values.createdBy = operatorId
    }
    if (hasColumn(table, "updatedBy") && values.updatedBy == null) {
        values.updatedBy = operatorId
    }

    return values
}

// Normal updates must not overwrite creation audit fields or soft-delete state.
function withUpdateAudit(table: MySqlTable, ctx: Context, data: RecordData) {
    const operatorId = getOperatorId(ctx)
    const { createdBy, createdAt, isDeleted, ...values } = data

    if (hasColumn(table, "updatedBy")) {
        values.updatedBy = operatorId
    }

    return values
}

// Soft delete is also an update, so keep the operator in updatedBy.
function withRemoveAudit(table: MySqlTable, ctx: Context) {
    const values: RecordData = { isDeleted: 1 }

    if (hasColumn(table, "updatedBy")) {
        values.updatedBy = getOperatorId(ctx)
    }

    return values
}

/**
 * Common repository factory for standard CRUD operations.
 */
export function CommonRepo<
    TSchema extends ZodObject<any>,
    TTable extends MySqlTable
>(table: TableWithId<TTable>, schema?: TSchema) {
    return function (ctx: Context) {
        type CreateInput = InferInsertModel<TTable>
        type UpdateInput = Partial<
            {
                [K in keyof CreateInput]: CreateInput[K] | null;
            }
        >

        return {
            async list(dto: any = {}, orderBy: SQL[] = [], extraWhere: SQL[] = []) {
                const dynamicWhere = schema
                    ? buildWhereBySchema(schema, table, dto)
                    : []
                const where = await buildScopedWhere(table, ctx, ...dynamicWhere, ...extraWhere)
                return ctx.db
                    .select()
                    .from(table)
                    .where(where)
                    .orderBy(...orderBy)
            },

            async page(page: number, pageSize: number, dto: any, orderBy: SQL[] = [], extraWhere: SQL[] = []) {
                const offset = (page - 1) * pageSize
                const dynamicWhere = schema
                    ? buildWhereBySchema(schema, table, dto)
                    : []
                const where = await buildScopedWhere(table, ctx, ...dynamicWhere, ...extraWhere)

                const totalResult = await ctx.db
                    .select({ total: count() })
                    .from(table)
                    .where(where)

                const total = totalResult[0]?.total ?? 0
                const data = await ctx.db
                    .select()
                    .from(table)
                    .where(where)
                    .orderBy(...orderBy)
                    .limit(pageSize)
                    .offset(offset)

                return {
                    total,
                    page,
                    pageSize,
                    list: data,
                }
            },

            async getOne(req: UpdateInput) {
                const dynamicWhere = schema
                    ? buildWhereBySchema(schema, table, req)
                    : []
                const where = await buildScopedWhere(table, ctx, ...dynamicWhere)
                const data = await ctx.db
                    .select()
                    .from(table)
                    .where(where)
                    .limit(1)

                return data ? data[0] : null
            },

            async getById(id: any) {
                const result = await ctx.db
                    .select()
                    .from(table)
                    .where(
                        await buildScopedWhere(table, ctx, eq(table.id, id))
                    )
                    .limit(1)

                return result[0] ?? null
            },

            async create(data: CreateInput) {
                // Add createdBy, updatedBy and isDeleted without requiring every table to define them.
                return ctx.db.insert(table).values(withCreateAudit(table, ctx, data as RecordData) as CreateInput)
            },

            async updateById(id: any, data: UpdateInput) {
                // Keep creation audit fields immutable during normal updates.
                return ctx.db
                    .update(table)
                    .set(withUpdateAudit(table, ctx, data as RecordData) as UpdateInput)
                    .where(await buildScopedWhere(table, ctx, eq(table.id, id)))
            },

            async remove(id: any) {
                // Soft delete through the same audit path as regular updates.
                return ctx.db
                    .update(table)
                    .set(withRemoveAudit(table, ctx) as any)
                    .where(await buildScopedWhere(table, ctx, eq(table.id, id)))
            },

            async batchRemove(ids: any[]) {
                if (ids.length === 0) {
                    return 0
                }
                // Batch soft delete keeps the same audit semantics as single delete.
                return ctx.db
                    .update(table)
                    .set(withRemoveAudit(table, ctx) as any)
                    .where(await buildScopedWhere(table, ctx, inArray(table.id, ids)))
            },
        }
    }
}
