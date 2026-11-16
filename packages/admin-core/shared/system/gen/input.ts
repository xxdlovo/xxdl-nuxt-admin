import { z } from 'zod'
import { ApiRequestSchema } from '#admin/shared/types/common'
import { GenColumnBaseSchema, GenTableBaseSchema } from './common'

export const GenPageQuerySchema = GenTableBaseSchema.pick({
    tableName: true,
    tableComment: true,
}).extend(ApiRequestSchema.shape)
export type GenPageQueryDTO = z.infer<typeof GenPageQuerySchema>

export const GenImportSchema = z.object({
    tableNames: z.array(z.string().min(1)).min(1, 'form.required'),
})
export type GenImportDTO = z.infer<typeof GenImportSchema>

export const GenUpdateTableSchema = z.object({
    id: z.string().min(1, 'form.id.required'),
    tableComment: z.string().max(255).optional(),
    moduleName: z.string().min(1, 'form.required').max(100),
    businessName: z.string().min(1, 'form.required').max(100),
    author: z.string().max(100).optional(),
    remark: z.string().max(255).optional(),
})
export type GenUpdateTableDTO = z.infer<typeof GenUpdateTableSchema>

export const GenColumnSaveSchema = GenColumnBaseSchema.pick({
    id: true,
    columnName: true,
    columnComment: true,
    columnType: true,
    tsType: true,
    propertyName: true,
    isPk: true,
    isRequired: true,
    isInsert: true,
    isEdit: true,
    isList: true,
    isQuery: true,
    queryType: true,
    dictCode: true,
    htmlType: true,
    sortOrder: true,
}).extend({
    id: z.string().min(1, 'form.id.required'),
    columnName: z.string().min(1, 'form.required'),
    propertyName: z.string().min(1, 'form.required'),
})
export type GenColumnSaveDTO = z.infer<typeof GenColumnSaveSchema>

export const GenSaveColumnsSchema = z.object({
    tableId: z.string().min(1, 'form.id.required'),
    columns: z.array(GenColumnSaveSchema),
})
export type GenSaveColumnsDTO = z.infer<typeof GenSaveColumnsSchema>

export const GenPreviewSchema = z.object({
    id: z.string().min(1, 'form.id.required'),
})
export type GenPreviewDTO = z.infer<typeof GenPreviewSchema>
