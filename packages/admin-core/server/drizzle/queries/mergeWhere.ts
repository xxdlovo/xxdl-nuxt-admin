import { and, SQL } from "drizzle-orm"

/** 合并多个条件 */
export function mergeWhere(...conds: (SQL | undefined)[]) {
    const valid = conds.filter(Boolean) as SQL[]
    return valid.length > 0 ? and(...valid) : undefined
}
