import { z } from "zod";


const baseSchema = z.object({
    code: z.number().default(200),
    success: z.boolean().default(true),
    msg: z.string().default("操作成功")
})

// ---------------------- 第一步：创建分页 Schema----------------------
/**
 * 分页响应结构（泛型，支持指定列表项类型）
 */
export function createPaginationSchema<T extends z.ZodTypeAny>(itemSchema: T) {
    return baseSchema.extend({
        total: z.number().int().nonnegative(),
        list: z.array(itemSchema)
    }).describe("分页格式响应")
}
export const ApiResp = () =>{
     return {
         successPage: (data: any) =>{
             return {
                 code: 200,
                 success: true,
                 msg: "操作成功",
                 list:data
             }
    }
     }
}
export type ApiPageResp<T> = z.infer<typeof createPaginationSchema<z.ZodType<T>>>
// ---------------------- 第二步：创建纯数据 Schema（泛型，支持单个/列表数据）----------------------
/**
 * 纯数据 Schema 工厂函数（泛型，支持指定数据类型）
 * 作用：处理后台直接返回的纯数据（单个对象/值）
 */
export function createPlainDataSchema<T extends z.ZodTypeAny>(dataSchema: T) {
    return baseSchema.extend({
        data: dataSchema
    }).describe("纯数据格式响应")

}
export type ApiDataResp<T> = z.infer<typeof createPlainDataSchema<z.ZodType<T>>>
//
// // ---------------------- 第三步：整合两种格式（统一响应 Schema，二选一）----------------------
// /**
//  * 统一后台响应 Schema 工厂函数（重命名：核心对外暴露，支持分页/纯数据二选一）
//  * 命名：createApiResponseSchema（语义化：表示后台 API 统一响应格式）
//  * 功能：自动兼容「分页响应」和「纯数据响应」，无需手动判断
//  */
// export function createApiResponseSchema<T extends z.ZodTypeAny>(dataItemSchema: T) {
//     // 1. 生成分页格式 Schema
//     const paginationResponseSchema = createPaginationSchema(dataItemSchema);
//     // 2. 生成纯数据列表 Schema（也支持单个数据，传入 z.object 即可）
//     const plainDataResponseSchema = createPlainDataSchema(z.union([z.array(dataItemSchema), dataItemSchema]));
//
//     // 3. 联合两种格式（二选一），实现「要么返回分页，要么返回纯数据」
//     return z.discriminatedUnion("hasPagination", [
//         // 格式1：分页响应（带 hasPagination: true 标识，方便前端判断）
//         paginationResponseSchema.extend({
//             hasPagination: z.literal(true).default(true)
//         }),
//         // 格式2：纯数据响应（带 hasPagination: false 标识，默认 false）
//         plainDataResponseSchema.extend({
//             hasPagination: z.literal(false).default(false)
//         })
//     ]);
// }
//
// // ---------------------- 第四步：默认导出（兼容 any 类型，快速使用）----------------------
// /**
//  * 默认 API 响应 Schema（list/data 为 any 类型，快速上手）
//  * 命名：DefaultApiResponseSchema
//  */
// export const DefaultApiResponseSchema = createApiResponseSchema(z.any());
//
// // ---------------------- 第五步：导出对应的 TypeScript 类型（统一命名）----------------------
// /**
//  * 默认 API 响应类型（兼容分页/纯数据，数据为 any 类型）
//  * 命名：ApiResponse
//  */
// export type ApiResponse = z.infer<typeof DefaultApiResponseSchema>;
//
// /**
//  * 泛型 API 响应类型（可指定数据项类型）
//  * 命名：GenericApiResponse
//  */
// export type GenericApiResponse<T> = z.infer<ReturnType<typeof createApiResponseSchema<z.ZodType<T>>>>;