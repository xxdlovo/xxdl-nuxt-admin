import { z } from "zod"
/**
 * 通用分页请求参数
 * 前端列表查询、后端分页接口统一使用
 */

export const ApiRequestSchema = z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(1000).default(10),
})
export type  ApiReq  = z.infer<typeof ApiRequestSchema>
/**
 * 带筛选条件的分页请求 Schema
 * 继承 ApiRequestSchema 的 page、pageSize 字段，新增 filter 筛选字段（单个对象）
 */
export const ApiQueryRequestSchema = ApiRequestSchema.extend({
    // 定义 filter 字段：单个对象，键是字符串、值是任意类型（去掉 z.array() 即可）
    filter: z.record(z.string(), z.any()) // 直接使用 z.record，对应 {string: any}
        .default({}) // 推荐：设置默认值为空对象，避免不传时出现 undefined
});

/**
 * 分页查询请求（包含过滤条件）
 */
export type ApiQueryReq = z.infer<typeof ApiQueryRequestSchema>;

/**
 * 分页 + 排序
 */
export type ApiReqWithSort  = z.infer<typeof ApiReqWithSortSchema>
export const ApiReqWithSortSchema = ApiRequestSchema.extend(
    {
        sort: z
            .object({
                field: z.string(),
                order: z.enum(["asc", "desc"]),
            })
            .array()
            .optional(),
    }
)