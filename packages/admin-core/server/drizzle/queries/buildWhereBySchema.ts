import { eq, like, SQL } from "drizzle-orm"
import { z, ZodObject } from "zod"

/**
 * 支持的查询操作符
 */
type QueryOperator = "eq" | "like"

/**
 * Schema meta 配置格式
 */
interface QueryMeta {
    query?: QueryOperator
}

/**
 * buildWhereBySchema
 *
 * 根据 Zod Schema 的 meta(query) 自动生成 drizzle 条件
 *
 * @param schema Zod Schema（带 meta 配置）
 * @param table drizzle table
 * @param dto 查询对象（前端传入）
 */
export function buildWhereBySchema<
    TSchema extends ZodObject<any>,
    TTable extends Record<string, any>
>(
    schema: TSchema,
    table: TTable,
    dto: Record<string, any>
): SQL[] {
    const conditions: SQL[] = []

    // schema 的字段定义
    const shape = schema.shape

    for (const key in shape) {
        const fieldSchema: any = shape[key]

        // dto 没传就跳过
        const value = dto[key]
        if (value === undefined || value === null || value === "") {
            continue
        }

        // drizzle table 中必须存在该字段
        if (!table[key]) {
            continue
        }

        // ✅ Zod v4 正确读取 meta
        const meta: QueryMeta | undefined = fieldSchema.meta?.()

        const operator: QueryOperator = meta?.query ?? "eq"
        // 根据 operator 构造条件
        switch (operator) {
            case "like":
                conditions.push(like(table[key], `%${value}%`))
                break

            case "eq":
            default:
                conditions.push(eq(table[key], value))
                break
        }
    }

    return conditions
}
