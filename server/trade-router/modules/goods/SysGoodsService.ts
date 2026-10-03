import { sysGoodsRepo } from './SysGoodsRepo'
import type { Context } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import { goodsService } from '#server/trade-router/domain/goods/GoodsService'
import { memberService } from '#server/trade-router/domain/member/MemberService'
import type {
    SysGoodsAddDTO,
    SysGoodsLevelPriceQueryDTO,
    SysGoodsLevelPriceRespDTO,
    SysGoodsLevelPricesSaveDTO,
    SysGoodsPageQueryDTO,
    SysGoodsQueryDTO,
    SysGoodsRespDTO,
    SysGoodsUpdateDTO
} from '#shared/system/goods'
import { randomUuid } from '#shared/utils/uuid'

/**
 * 等级价回显行：取契约 `SysGoodsLevelPriceRespSchema` 的子集。
 * 领域层的等级价视图只有 levelId / price / remark（不含 id、goodsId），等级名由模块层合并。
 */
type SysGoodsLevelPriceRow = Pick<
    SysGoodsLevelPriceRespDTO,
    'levelId' | 'levelName' | 'price' | 'remark'
>

export function sysGoodsService(ctx: Context) {
    const repo = sysGoodsRepo(ctx)
    // 上下架校验、等级价解析、库存与销量等业务规则全部收敛在领域层，这里只做入参校验与透传
    const goods = goodsService(ctx.db)
    // 等级是会员域的字典数据，商品域不跨域查询，模块层负责合并
    const members = memberService(ctx.db)

    const operatorId = () => ctx.user?.id ?? null

    return {
        /**
         * 新增：主键由后端生成（契约里的 id 只用于修改定位）。
         * price 是 decimal(12,2)，drizzle 按字符串读写，这里只做类型适配不做金额校验。
         */
        async create(data: SysGoodsAddDTO): Promise<boolean> {
            await repo.create({
                ...data,
                id: randomUuid(),
                price: String(data.price)
            })

            return true
        },

        async remove(id: string): Promise<boolean> {
            await repo.remove(id)
            return true
        },

        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            return ids.length
        },

        /** 修改：先确认存在（同时过数据权限），等级价不在本接口维护，走 saveLevelPrices */
        async updateById(id: string, data: SysGoodsUpdateDTO): Promise<boolean> {
            const row = await repo.getById(id)

            if (!row) {
                throw new AppError('common.notExist')
            }

            const { id: _id, ...rest } = data

            await repo.updateById(id, {
                ...rest,
                price: String(rest.price)
            })

            return true
        },

        async getOne(req: SysGoodsQueryDTO): Promise<SysGoodsRespDTO> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo as SysGoodsRespDTO
        },

        async getById(id: string): Promise<SysGoodsRespDTO> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo as SysGoodsRespDTO
        },

        /**
         * 分页：priceMin / priceMax / createdFrom / createdTo 交给 Repo 用 extraWhere 追加。
         *
         * 列表行额外回填 `levelPriceCount`（该商品配了几个等级价）：分页之后**一次**
         * `group by goods_id` 批量统计，替代前端逐行调 `levelPrices`（每行 3 条 SQL）。
         * 该字段只用于列表展示，成交价仍按下单时的实时等级价解析。
         */
        async page(req: SysGoodsPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, priceMin, priceMax, createdFrom, createdTo, ...dto } = req

            const result = await repo.pageWithRange(page, pageSize, dto, {
                priceMin,
                priceMax,
                createdFrom,
                createdTo
            })

            const list = (result.list ?? []) as SysGoodsRespDTO[]
            const goodsIds = list
                .map(row => String(row.id ?? ''))
                .filter(id => id !== '')
            const countByGoodsId = goodsIds.length > 0
                ? await goods.countLevelPricesByGoodsIds(goodsIds)
                : new Map<string, number>()

            return {
                ...result,
                list: list.map(row => ({
                    ...row,
                    // 没有等级价的行统一给 0：前端只判断 count > 0，不必再区分 null
                    levelPriceCount: countByGoodsId.get(String(row.id)) ?? 0
                }))
            }
        },

        /** 等级下拉：只取启用中的会员等级，供商品弹窗配置等级价（其余等级不需要配价） */
        async levelOptions() {
            return await members.listLevels()
        },

        /**
         * 等级价回显：领域层返回的等级价不含等级名（领域层不跨域查会员等级），
         * 这里用启用等级名单补 levelName；等级被停用时兜底为 null，前端按 id 展示。
         */
        async levelPrices(req: SysGoodsLevelPriceQueryDTO): Promise<SysGoodsLevelPriceRow[]> {
            const goodsId = String(req.goodsId ?? '').trim()

            if (!goodsId) {
                throw new AppError('common.notExist')
            }
            if (!(await repo.getById(goodsId))) {
                throw new AppError('common.notExist')
            }

            const [rows, levels] = await Promise.all([
                goods.listLevelPrices(goodsId),
                members.listLevels()
            ])
            const nameById = new Map<string, string>(levels.map(level => [level.id, level.name]))

            return rows.map(row => ({
                levelId: row.levelId,
                levelName: nameById.get(row.levelId) ?? null,
                price: row.price,
                remark: row.remark
            }))
        },

        /**
         * 保存等级价：整体替换，事务与「price 为空的项跳过」都在领域层实现，
         * 返回实际写入的行数（items 为空即清空该商品的等级价）。
         */
        async saveLevelPrices(input: SysGoodsLevelPricesSaveDTO): Promise<number> {
            return await goods.saveLevelPrices({
                goodsId: input.goodsId,
                items: input.items,
                operatorId: operatorId()
            })
        }
    }
}
