import { z } from 'zod'

/**
 * 商品/服务基础 Schema —— 与 sys_goods 表结构保持一致。
 * 所有字段统一 nullish()，便于 pick() / extend() 复用；必填规则在 input.ts 覆盖。
 * 金额字段在 MySQL 中是 decimal(12,2)，drizzle 读出为字符串，这里用 string | number 兼容表单。
 *
 * 服务（如应用迁移）不单独建实体：`type = 'service'` + `unlimitedStock = 1`，
 * 差异只体现在「不扣库存、需要联系方式、支付后需要后台交付」三点。
 */
export const SysGoodsBaseSchema = z.object({
    id: z.string().nullish(),
    name: z.string().nullish().meta({ query: 'like' }),
    subtitle: z.string().nullish().meta({ query: 'like' }),
    cover: z.string().nullish(),
    /** 基础价(元)：会员等级未配专属价时使用 */
    price: z.union([z.string(), z.number()]).nullish(),
    stock: z.number().nullish(),
    /** 1=不限库存（虚拟/服务类默认建议开启） */
    unlimitedStock: z.number().nullish(),
    salesCount: z.number().nullish(),
    /** virtual 虚拟物品 / service 人工服务 / physical 实物(预留) */
    type: z.string().nullish(),
    /** 服务类下单提示/交付说明 */
    serviceNotice: z.string().nullish(),
    detail: z.string().nullish(),
    sortOrder: z.number().nullish(),
    status: z.number().nullish(),
    remark: z.string().nullish(),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysGoodsDto = z.infer<typeof SysGoodsBaseSchema>

/** 商品等级价基础 Schema —— 与 sys_goods_level_price 表结构保持一致 */
export const SysGoodsLevelPriceBaseSchema = z.object({
    id: z.string().nullish(),
    goodsId: z.string().nullish(),
    levelId: z.string().nullish(),
    /** 该等级专属价(元) */
    price: z.union([z.string(), z.number()]).nullish(),
    remark: z.string().nullish(),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysGoodsLevelPriceDto = z.infer<typeof SysGoodsLevelPriceBaseSchema>
