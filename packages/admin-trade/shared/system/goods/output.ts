import { z } from 'zod'
import { SysGoodsBaseSchema, SysGoodsLevelPriceBaseSchema } from './common'

/** 商品响应：后台列表与表单展示字段一一对应 */
export const SysGoodsRespSchema = z.object({
    id: SysGoodsBaseSchema.shape.id,
    name: SysGoodsBaseSchema.shape.name,
    subtitle: SysGoodsBaseSchema.shape.subtitle,
    cover: SysGoodsBaseSchema.shape.cover,
    price: SysGoodsBaseSchema.shape.price,
    stock: SysGoodsBaseSchema.shape.stock,
    unlimitedStock: SysGoodsBaseSchema.shape.unlimitedStock,
    salesCount: SysGoodsBaseSchema.shape.salesCount,
    type: SysGoodsBaseSchema.shape.type,
    serviceNotice: SysGoodsBaseSchema.shape.serviceNotice,
    detail: SysGoodsBaseSchema.shape.detail,
    sortOrder: SysGoodsBaseSchema.shape.sortOrder,
    status: SysGoodsBaseSchema.shape.status,
    remark: SysGoodsBaseSchema.shape.remark,
    createdAt: SysGoodsBaseSchema.shape.createdAt,
    updatedAt: SysGoodsBaseSchema.shape.updatedAt,
    /**
     * 该商品已配置的等级价条数：**列表页展示用**（如「3 个等级价」），
     * 由 `SysGoodsService.page` 一页一次批量统计回填，无等级价时为 0。
     * 成交价始终按下单时实时解析（`resolvePrice`），不要用这个字段参与计价。
     */
    levelPriceCount: z.number().nullish(),
})
export type SysGoodsRespDTO = z.infer<typeof SysGoodsRespSchema>

/** 商品等级价响应（商品编辑弹窗回显） */
export const SysGoodsLevelPriceRespSchema = z.object({
    id: SysGoodsLevelPriceBaseSchema.shape.id,
    goodsId: SysGoodsLevelPriceBaseSchema.shape.goodsId,
    levelId: SysGoodsLevelPriceBaseSchema.shape.levelId,
    price: SysGoodsLevelPriceBaseSchema.shape.price,
    /** 等级名称：联表带出，便于前端直接展示 */
    levelName: z.string().nullish(),
    remark: SysGoodsLevelPriceBaseSchema.shape.remark,
})
export type SysGoodsLevelPriceRespDTO = z.infer<typeof SysGoodsLevelPriceRespSchema>

/**
 * 商城商品卡片：在商品字段之上补「我实际要付多少」。
 * `myPrice` 由服务端按下单会员的等级解析（等级价 > 基础价），前端不参与计算。
 */
export const SysMallGoodsRespSchema = z.object({
    id: z.string(),
    name: z.string(),
    subtitle: z.string().nullish(),
    cover: z.string().nullish(),
    type: z.string().nullish(),
    serviceNotice: z.string().nullish(),
    detail: z.string().nullish(),
    /** 基础价 */
    price: z.string(),
    /** 当前会员实际单价 */
    myPrice: z.string(),
    /** 价格来源：base 基础价 / level 等级价 */
    priceSource: z.string(),
    /** 命中的等级名称（priceSource=level 时有值） */
    levelName: z.string().nullish(),
    /** 1=不限库存（前端显示「不限量」） */
    unlimitedStock: z.number(),
    /** 剩余库存（不限库存时为 null） */
    stock: z.number().nullish(),
    salesCount: z.number().nullish(),
})
export type SysMallGoodsRespDTO = z.infer<typeof SysMallGoodsRespSchema>
