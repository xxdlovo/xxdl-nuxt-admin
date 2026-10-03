/**
 * 商品域服务：上架校验、等级价解析、库存与销量的唯一入口。
 *
 * 对外只依赖 `../wallet/utils` 的金额工具与 `AppError`，不感知订单与支付；
 * 订单域通过 `goodsServiceIn(tx)` 复用同一个事务内的商品能力。
 */
import { AppError } from '#server/utils/appError'
import { type AppDb, type AppExecutor, type AppTx } from '#server/drizzle/db'
import { randomUuid } from '#shared/utils/uuid'
import { normalizeMoney } from '../wallet/utils'
import { goodsRepo, type GoodsRow } from './repo/goodsRepo'
import { goodsLevelPriceRepo } from './repo/goodsLevelPriceRepo'
import type { GoodsLevelPriceInput, PriceSource, ResolvedPrice } from './types'

/** 商品等级价列表项（等级名由模块层合并，领域层不跨域查会员等级） */
export type GoodsLevelPriceView = {
  levelId: string
  price: string
  remark: string | null
}

export function buildGoods(executor: AppExecutor) {
  const goods = goodsRepo(executor)
  const levelPrices = goodsLevelPriceRepo(executor)

  /** 取一件可下单的商品，不存在/已下架分别给出明确错误 */
  async function assertPurchasable(goodsId: string): Promise<GoodsRow> {
    const row = await goods.findById(goodsId)

    if (!row) {
      throw new AppError('module.system.order.goodsNotFound')
    }

    if (Number(row.status ?? 0) !== 1) {
      throw new AppError('module.system.order.goodsOffline')
    }

    return row
  }

  /**
   * 解析成交单价。优先级：会员协议价(预留未实现) > 等级价 > 基础价。
   * 注意：`normalizeMoney` 会把 0 视为非法（默认不允许 0 元），这里一律 `allowZero: true`，
   * 免费商品（0 元）与付费商品走同一条链路，是否需要拦截由调用方决定。
   */
  async function resolvePrice(input: {
    goods: GoodsRow
    levelId?: string | null
  }): Promise<ResolvedPrice> {
    const base = normalizeMoney(input.goods.price ?? '0.00', { allowZero: true })
    const levelId = input.levelId ?? null

    if (!levelId) {
      return { unitPrice: base, priceSource: 'base', levelId: null }
    }

    const hit = await levelPrices.findByGoodsAndLevel(input.goods.id, levelId)

    if (!hit) {
      return { unitPrice: base, priceSource: 'base', levelId }
    }

    return {
      unitPrice: normalizeMoney(hit.price ?? '0.00', { allowZero: true }),
      priceSource: 'level',
      levelId
    }
  }

  /**
   * 批量解析（商城列表）：一次查全部商品的等级价，避免 N+1。
   * 返回 Map<goodsId, ResolvedPrice>，调用方按商品 id 取。
   */
  async function resolvePrices(input: {
    goodsList: GoodsRow[]
    levelId?: string | null
    levelName?: string | null
  }): Promise<Map<string, ResolvedPrice>> {
    const result = new Map<string, ResolvedPrice>()
    const levelId = input.levelId ?? null
    const rows = levelId
      ? await levelPrices.listByGoodsIds(input.goodsList.map(item => item.id))
      : []

    const priceByGoodsId = new Map(
      rows.filter(row => row.levelId === levelId).map(row => [row.goodsId, row])
    )

    for (const item of input.goodsList) {
      const base = normalizeMoney(item.price ?? '0.00', { allowZero: true })
      const hit = levelId ? priceByGoodsId.get(item.id) : undefined

      result.set(item.id, hit
        ? {
            unitPrice: normalizeMoney(hit.price ?? '0.00', { allowZero: true }),
            priceSource: 'level' as PriceSource,
            levelId,
            levelName: input.levelName ?? null
          }
        : {
            unitPrice: base,
            priceSource: 'base' as PriceSource,
            levelId,
            levelName: null
          })
    }

    return result
  }

  /** 后台读取等级价（不含等级名，由模块层补） */
  async function listLevelPrices(goodsId: string): Promise<GoodsLevelPriceView[]> {
    const rows = await levelPrices.listByGoodsId(goodsId)

    return rows.map(row => ({
      levelId: row.levelId,
      price: normalizeMoney(row.price ?? '0.00', { allowZero: true }),
      remark: row.remark ?? null
    }))
  }

  /**
   * 批量统计每个商品配了几个等级价（后台商品列表一页一次 group by）。
   * 仅用于列表展示：成交单价仍由 `resolvePrice/resolvePrices` 在下单链路实时解析。
   * 返回 Map<goodsId, count>，没有等级价的商品不会出现在 Map 里（调用方按 0 处理）。
   */
  async function countLevelPricesByGoodsIds(goodsIds: string[]): Promise<Map<string, number>> {
    const rows = await levelPrices.countByGoodsIds(goodsIds)

    return new Map(rows.map(row => [row.goodsId, Number(row.count) || 0]))
  }

  /**
   * 保存等级价：整体替换。
   * 先物理清空该商品旧行再插入新行（唯一键不含 is_deleted，软删会撞键），
   * price 为空/负数的项直接跳过（等价于「该等级用基础价」）。
   */
  async function saveLevelPrices(input: {
    goodsId: string
    items: GoodsLevelPriceInput[]
    operatorId?: string | null
  }) {
    const operatorId = input.operatorId ?? null
    const existing = await goods.findById(input.goodsId)

    if (!existing) {
      throw new AppError('module.system.order.goodsNotFound')
    }

    await levelPrices.deleteByGoodsId(input.goodsId)

    const rows = input.items
      .filter(item => item.price !== null && item.price !== undefined && String(item.price).trim() !== '')
      .map(item => ({
        id: randomUuid(),
        goodsId: input.goodsId,
        levelId: item.levelId,
        price: normalizeMoney(item.price as string | number, { allowZero: true }),
        remark: item.remark ?? null,
        createdBy: operatorId,
        updatedBy: operatorId,
        isDeleted: 0
      }))

    await levelPrices.insertMany(rows)

    return rows.length
  }

  /** 扣库存（不限库存商品自动放行），不足即抛错 */
  async function decreaseStockOrThrow(goodsId: string, quantity: number) {
    const affected = await goods.decreaseStock(goodsId, quantity)

    if (affected === 0) {
      throw new AppError('module.system.order.stockNotEnough')
    }
  }

  /** 回滚库存（取消/关闭订单时调用；不限库存商品不动库存） */
  async function rollbackStock(goodsId: string, quantity: number) {
    return await goods.increaseStock(goodsId, quantity)
  }

  /** 累加销量（支付完成后调用一次） */
  async function increaseSales(goodsId: string, quantity: number) {
    return await goods.increaseSales(goodsId, quantity)
  }

  /** 商城分页（只列上架商品） */
  async function pageEnabled(params: {
    page: number
    pageSize: number
    keyword?: string | null
    type?: string | null
  }) {
    return await goods.pageEnabled(params)
  }

  async function getById(goodsId: string) {
    return await goods.findById(goodsId)
  }

  return {
    assertPurchasable,
    resolvePrice,
    resolvePrices,
    listLevelPrices,
    countLevelPricesByGoodsIds,
    saveLevelPrices,
    decreaseStockOrThrow,
    rollbackStock,
    increaseSales,
    pageEnabled,
    getById
  }
}

/** 绑定到已有事务（订单下单链路：扣库存 + 落单 + 冻结同一个事务） */
export function goodsServiceIn(executor: AppExecutor) {
  return buildGoods(executor)
}

/** 独立使用：写方法自带事务 */
export function goodsService(db: AppDb) {
  const reads = buildGoods(db)
  const run = async <T>(fn: (tx: AppTx) => Promise<T>): Promise<T> => await db.transaction(async tx => await fn(tx))

  return {
    ...reads,
    saveLevelPrices: async (input: Parameters<typeof reads.saveLevelPrices>[0]) => await run(tx => buildGoods(tx).saveLevelPrices(input))
  }
}

export type GoodsService = ReturnType<typeof goodsService>
