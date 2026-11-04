/**
 * 商品域的统一契约。
 *
 * 服务（如应用迁移）不是独立实体，而是 `type = 'service'` 的商品：
 * 差异只在「不扣库存、需要联系方式、支付后需要交付」，因此订单侧只感知类型，不感知业务名词。
 */

/** 商品类型：虚拟物品 / 人工服务 / 实物(预留) */
export type GoodsType = 'virtual' | 'service' | 'physical'

/**
 * 价格来源。优先级固定为：会员协议价(member，预留未实现) > 等级价(level) > 基础价(base)。
 * 落库到 `sys_order.price_source`，用于事后解释「为什么这一单是这个价」。
 */
export type PriceSource = 'base' | 'level' | 'member'

/** 单个商品的价格解析结果 */
export type ResolvedPrice = {
  /** 成交单价（元，两位小数） */
  unitPrice: string
  priceSource: PriceSource
  /** 命中的等级（priceSource=base 时也带上会员当前等级，便于追溯） */
  levelId: string | null
  /** 命中的等级名称（商城展示用，列表批量解析时不查名称则为 null） */
  levelName?: string | null
}

/** 等级价写入项（price 为空表示删除该等级的专属价） */
export type GoodsLevelPriceInput = {
  levelId: string
  price?: string | number | null
  remark?: string | null
}
