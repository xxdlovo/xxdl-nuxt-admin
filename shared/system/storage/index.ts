import { z } from 'zod'

/** 存储管理允许访问的两个逻辑桶。assets 默认对应 server/storage。 */
export const StorageBucketSchema = z.enum(['memory', 'assets'])
export type StorageBucket = z.infer<typeof StorageBucketSchema>

/** 列表查询参数；pageSize 上限由 schema 和服务端共同保证。 */
export const SysStorageListSchema = z.object({
  bucket: StorageBucketSchema,
  prefix: z.string().max(200).optional(),
  /** 资源桶根目录，必须位于 server/storage 下。 */
  resourcePath: z.string().max(300).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20)
})

/** 详情查询参数。key 是桶内相对 key，不允许带 storage 前缀。 */
export const SysStorageGetSchema = z.object({
  bucket: StorageBucketSchema,
  key: z.string().min(1).max(500),
  /** 可传 server/storage/xxx 形式的资源根目录。 */
  resourcePath: z.string().max(300).optional()
})

/** 删除接口明确限定为 memory 桶，资源桶永远只读。 */
export const SysStorageRemoveSchema = z.object({
  bucket: z.literal('memory'),
  key: z.string().min(1).max(500)
})

export const SysStorageEntrySchema = z.object({
  key: z.string(),
  valueType: z.string(),
  size: z.number().nonnegative(),
  updatedAt: z.string().nullable(),
  previewable: z.boolean()
})

export const SysStorageListResponseSchema = z.object({
  list: z.array(SysStorageEntrySchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number()
})

export const SysStorageDetailSchema = SysStorageEntrySchema.extend({
  preview: z.string().nullable(),
  mimeType: z.string().nullable()
})

export type SysStorageListInput = z.infer<typeof SysStorageListSchema>
export type SysStorageGetInput = z.infer<typeof SysStorageGetSchema>
export type SysStorageRemoveInput = z.infer<typeof SysStorageRemoveSchema>
export type SysStorageEntry = z.infer<typeof SysStorageEntrySchema>
export type SysStorageDetail = z.infer<typeof SysStorageDetailSchema>
