import { mergeWhere } from "./queries/mergeWhere"
import { buildScope } from "./queries/buildScope"
import { buildWhereBySchema } from "./queries/buildWhereBySchema"
import {Column, count, eq, type InferInsertModel} from "drizzle-orm"

import {ZodObject} from "zod";
import type { Context } from '#server/trpc/context';
import {MySqlTable} from "drizzle-orm/mysql-core/table";


type TableWithId<T extends MySqlTable> = T & { id: Column<any>;isDeleted: Column<any>}
/**
 * 通用 Repo 工厂, 用来存放通用的增删改查逻辑
 */
export function CommonRepo<
    TSchema extends ZodObject<any>,
    TTable extends MySqlTable
>(table:  TableWithId<TTable>, schema?: TSchema) {
    return function (ctx:Context) {
        type CreateInput = InferInsertModel<TTable>
        /** Update 类型（部分字段更新） */
        type UpdateInput = Partial<CreateInput>
        return {
            /** ✅ 查询列表 */
            async list(dto: any = {}) {
                const dynamicWhere = schema
                    ? buildWhereBySchema(schema, table, dto)
                    : []

                return ctx.db
                    .select()
                    .from(table)
                    .where(
                        mergeWhere(
                            ...buildScope(table, ctx),
                            ...dynamicWhere
                        )
                    )
            },

            /** ✅ 分页查询 */
            async page(page:number, pageSize:number, dto:any) {

                const offset = (page - 1) * pageSize

                const dynamicWhere = schema
                    ? buildWhereBySchema(schema, table, dto)
                    : []

                const where = mergeWhere(
                    ...buildScope(table, ctx),
                    ...dynamicWhere
                )
                /** 总数 */
                const totalResult = await ctx.db
                    .select({ total: count() })
                    .from(table)
                    .where(where)

                const total = totalResult[0]?.total ?? 0
                // 数据
                const data = await ctx.db
                    .select()
                    .from(table)
                    .where(where)
                    .limit(pageSize)
                    .offset(offset)

                return {
                    total,
                    page,
                    pageSize,
                    list:data,
                }
            },
            /** ✅ 根据 参数 查询 */
            async getOne(req:UpdateInput){
                const dynamicWhere = schema
                    ? buildWhereBySchema(schema, table, req)
                    : []

                const where = mergeWhere(
                    ...buildScope(table, ctx),
                    ...dynamicWhere
                )
                const data = await ctx.db
                    .select()
                    .from(table)
                    .where(where)
                    .limit(1)
                return data? data[0] : null
            },
            /** ✅ 根据 ID 查询 */
            async getById( id: any) {
                const result = await ctx.db
                    .select()
                    .from(table)
                    .where(
                        mergeWhere(
                            ...buildScope(table, ctx),
                            eq(table.id, id)
                        )
                    )
                    .limit(1)

                return result[0] ?? null
            },

            /** ✅ 新增 */
            async create( data: CreateInput) {
                return ctx.db.insert(table).values({
                    ...data,
                    isDeleted: 0
                })
            },

            /** ✅ 更新 */
            async updateById(id: any, data: UpdateInput) {
                return ctx.db
                    .update(table)
                    .set(data)
                    .where(eq(table.id, id))
            },

            /** ✅ 逻辑删除 */
            async remove( id: any) {
                var column = table.isDeleted;
                return ctx.db
                    .update(table)
                    .set({[column.name]: 1} as any)
                    .where(eq(table.id, id))
            },
        }
    }
}
