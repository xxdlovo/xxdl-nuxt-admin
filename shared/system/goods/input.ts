import { z } from 'zod'
import { SysGoodsBaseSchema, SysGoodsLevelPriceBaseSchema } from './common'
import { ApiRequestSchema } from '#shared/types/common'

/** 商品类型：虚拟物品 / 人工服务 / 实物(预留) */
export const SysGoodsTypeSchema = z.enum(['virtual', 'service', 'physical'])

// 新增
export const SysGoodsAddSchema = SysGoodsBaseSchema.pick({
    name: true,
    subtitle: true,
    cover: true,
    price: true,
    stock: true,
    unlimitedStock: true,
    type: true,
    serviceNotice: true,
    detail: true,
    sortOrder: true,
    status: true,
    remark: true,
}).extend({
    id: SysGoodsBaseSchema.shape.id.nonoptional(),
    name: z.string().min(1, 'form.required').max(100, 'form.required'),
    subtitle: z.string().max(200).nullish(),
    cover: z.string().max(500).nullish(),
    price: z.union([z.string(), z.number()]),
    stock: z.number().int().min(0).default(0),
    unlimitedStock: z.number().default(0),
    type: SysGoodsTypeSchema.default('virtual'),
    serviceNotice: z.string().max(500).nullish(),
    detail: z.string().nullish(),
    sortOrder: z.number().int().default(0),
    status: z.number().default(1),
    remark: z.string().max(255).nullish(),
})
export type SysGoodsAddDTO = z.infer<typeof SysGoodsAddSchema>

// 修改：字段与新增一致，id 由可空改为必填
export const SysGoodsUpdateSchema = SysGoodsAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysGoodsUpdateDTO = z.infer<typeof SysGoodsUpdateSchema>

// 查询条件：表字段交给 CommonRepo，区间类非表字段由 Repo 消费
export const SysGoodsQuerySchema = SysGoodsBaseSchema.pick({
    id: true,
    name: true,
    subtitle: true,
    type: true,
    status: true,
}).extend({
    /** 不限库存筛选：1 只看不限库存商品 */
    unlimitedStock: z.number().nullish(),
    /** 价格区间（非表字段，由 Repo 用区间条件消费） */
    priceMin: z.union([z.string(), z.number()]).nullish(),
    priceMax: z.union([z.string(), z.number()]).nullish(),
    /** 创建时间区间 YYYY-MM-DD HH:mm:ss（非表字段） */
    createdFrom: z.string().max(30).nullish(),
    createdTo: z.string().max(30).nullish(),
})
export type SysGoodsQueryDTO = z.infer<typeof SysGoodsQuerySchema>

// 分页查询：查询条件 + 分页参数
export const SysGoodsPageQuerySchema = SysGoodsQuerySchema.extend(ApiRequestSchema.shape)
export type SysGoodsPageQueryDTO = z.infer<typeof SysGoodsPageQuerySchema>

/** 商品等级价：一行一个等级，价格留空表示该等级用基础价（不需要提交该行） */
export const SysGoodsLevelPriceItemSchema = z.object({
    levelId: z.string().min(1, 'form.required').max(36, 'form.required'),
    price: z.union([z.string(), z.number()]),
    remark: z.string().max(255).nullish(),
})
export type SysGoodsLevelPriceItemDTO = z.infer<typeof SysGoodsLevelPriceItemSchema>

/** 保存等级价：整体替换（先软删旧行再插新行），items 为空表示清空等级价 */
export const SysGoodsLevelPricesSaveSchema = z.object({
    goodsId: z.string().min(1, 'form.required').max(36, 'form.required'),
    items: z.array(SysGoodsLevelPriceItemSchema).max(50).default([]),
})
export type SysGoodsLevelPricesSaveDTO = z.infer<typeof SysGoodsLevelPricesSaveSchema>

/** 商城浏览（会员自助，只返回上架商品） */
export const SysMallQuerySchema = z.object({
    keyword: z.string().max(50).nullish(),
    type: SysGoodsTypeSchema.nullish(),
}).extend(ApiRequestSchema.shape)
export type SysMallQueryDTO = z.infer<typeof SysMallQuerySchema>

/** 等级价行（供商品编辑弹窗回显） */
export const SysGoodsLevelPriceQuerySchema = SysGoodsLevelPriceBaseSchema.pick({
    goodsId: true,
})
export type SysGoodsLevelPriceQueryDTO = z.infer<typeof SysGoodsLevelPriceQuerySchema>
