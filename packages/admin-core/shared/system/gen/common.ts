import z from 'zod'

export const GenTableBaseSchema = z.object({
    id: z.string().nullish(),
    tableName: z.string().nullish().meta({ query: 'like' }),
    tableComment: z.string().nullish().meta({ query: 'like' }),
    moduleName: z.string().nullish(),
    businessName: z.string().nullish(),
    author: z.string().nullish(),
    remark: z.string().nullish(),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type GenTableDto = z.infer<typeof GenTableBaseSchema>

export const GenColumnBaseSchema = z.object({
    id: z.string().nullish(),
    tableId: z.string().nullish(),
    columnName: z.string().nullish(),
    columnComment: z.string().nullish(),
    columnType: z.string().nullish(),
    tsType: z.string().nullish(),
    propertyName: z.string().nullish(),
    isPk: z.number().nullish(),
    isRequired: z.number().nullish(),
    isInsert: z.number().nullish(),
    isEdit: z.number().nullish(),
    isList: z.number().nullish(),
    isQuery: z.number().nullish(),
    queryType: z.string().nullish(),
    dictCode: z.string().nullish(),
    htmlType: z.string().nullish(),
    sortOrder: z.number().nullish(),
})
export type GenColumnDto = z.infer<typeof GenColumnBaseSchema>

export type GenTableConfig = {
    table: GenTableDto
    columns: GenColumnDto[]
}

export type GenDbTable = {
    tableName: string
    tableComment: string
    imported: boolean
}
