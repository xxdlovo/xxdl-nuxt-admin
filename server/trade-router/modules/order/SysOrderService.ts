//#server/trade-router/modules/order
import { useLogger } from 'evlog'
/**
 * 订单模块 Service：后台管理（查询 / 备注 / 确认 / 关闭 / 同步 / 交付 / 统计）
 * + 会员自助（我的订单 / 下单 / 确认 / 取消 / 同步） + 商城浏览。
 *
 * 状态机与资金一致性全部收敛在领域层 `orderService(ctx.db)`，本文件只做三件事：
 * 1. 后台入参收敛与数据权限（数据权限在 Repo 的 `buildScopedWhere` 统一叠加）；
 * 2. 自助接口的**归属校验**（只能读/操作自己的单，越权按「不存在」处理）；
 * 3. 商城卡片的「我的价格」组装（商品域算价 + 会员域等级名）。
 */
import { getRequestURL } from 'h3'
import { AppError } from '#server/utils/appError'
import { requireLogin } from '#server/utils/routeGuard'
import { orderService } from '#server/trade-router/domain/order/OrderService'
import { goodsService } from '#server/trade-router/domain/goods/GoodsService'
import { memberService } from '#server/trade-router/domain/member/MemberService'
import { payOrderService } from '#server/trade-router/domain/pay/PayOrderService'
import type { Context } from '#server/trpc/context'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { GoodsRow } from '#server/trade-router/domain/goods/repo/goodsRepo'
import type {
    SysOrderCloseDTO,
    SysOrderConfirmDTO,
    SysOrderCreateDTO,
    SysOrderFulfillDTO,
    SysOrderMyQueryDTO,
    SysOrderNoDTO,
    SysOrderPageQueryDTO,
    SysOrderQueryDTO,
    SysOrderRespDTO,
    SysOrderSummaryDTO,
    SysOrderSyncDTO,
    SysOrderUpdateDTO
} from '#shared/system/order'
import type { SysMallGoodsRespDTO, SysMallQueryDTO } from '#shared/system/goods'
import type { SysMemberUserOptionQueryDTO } from '#shared/system/member'
import { sysOrderRepo } from './SysOrderRepo'

/** 商城卡片里的「我的价格」：只取商品域解析结果中本模块要用的字段 */
type MallResolvedPrice = {
    unitPrice: string
    priceSource: string
}

/**
 * 商品行 + 解析价 → 商城卡片。
 * 领域层已经给出成交单价与来源，本函数只做字段搬运与「不限库存时库存为 null」的展示口径。
 */
function toMallCard(
    row: GoodsRow,
    price: MallResolvedPrice,
    levelName: string | null
): SysMallGoodsRespDTO {
    const unlimitedStock = Number(row.unlimitedStock ?? 0)

    return {
        id: row.id,
        name: row.name,
        subtitle: row.subtitle ?? null,
        cover: row.cover ?? null,
        type: row.type,
        serviceNotice: row.serviceNotice ?? null,
        detail: row.detail ?? null,
        price: row.price,
        myPrice: price.unitPrice,
        priceSource: price.priceSource,
        levelName,
        unlimitedStock,
        stock: unlimitedStock === 1 ? null : row.stock,
        salesCount: row.salesCount ?? null
    }
}

export function sysOrderService(ctx: Context) {
    const repo = sysOrderRepo(ctx)
    // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
    const log = useLogger(ctx.event, 'server/trade-router/order')
    // 下单 / 确认 / 关闭 / 交付 / 同步：一律调领域，模块层不改状态、不动资金
    const orders = orderService(ctx.db)
    const goods = goodsService(ctx.db)
    const members = memberService(ctx.db)

    const operatorId = () => ctx.user?.id ?? null

    /**
     * 自助接口的归属校验：订单不存在或不属于当前用户，统一按「不存在」返回，
     * 避免登录用户用订单号探测他人订单。
     */
    async function requireMyOrder(orderNo: string) {
        const user = requireLogin(ctx)
        const order = await orders.getByOrderNo(orderNo)

        if (!order || order.userId !== user.id) {
            throw new AppError('common.notExist')
        }

        return { user, order }
    }

    /**
     * 删除保护：只有已关闭（CL）/ 发起失败（FL）的订单可以删除。
     * - 待支付（WP）要先关闭：否则会留下悬挂的冻结单与优惠码占用；
     * - 已完成（OD）是收入凭证，不允许删除。
     */
    async function assertRemovable(ids: string[]) {
        for (const id of ids) {
            const row = await repo.getById(id)

            if (!row) {
                throw new AppError('common.notExist')
            }

            if (row.status !== 'CL' && row.status !== 'FL') {
                throw new AppError('module.system.order.deleteNotAllowed')
            }
        }
    }

    return {
        // ── 后台管理 ────────────────────────────────────────────────────────

        async getOne(req: SysOrderQueryDTO): Promise<SysOrderRespDTO> {
            const pojo = await repo.getOne(req)

            if (!pojo) throw new AppError('common.notExist')

            log.info('order fetched', { order: { action: 'getOne' } })
            return pojo as SysOrderRespDTO
        },

        /** 详情：联表返回昵称、账号、手机号与等级名 */
        async getById(id: string): Promise<SysOrderRespDTO> {
            const profile = await repo.getProfileById(id)

            if (!profile) throw new AppError('common.notExist')

            log.info('order fetched', { order: { action: 'getById', id } })
            return profile as SysOrderRespDTO
        },

        async page(req: SysOrderPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, amountMin, amountMax, createdFrom, createdTo, ...dto } = req

            const result = await repo.pageWithProfile(page, pageSize, dto, {
                amountMin,
                amountMax,
                createdFrom,
                createdTo
            })

            log.info('order page queried', {
                order: { action: 'page', page, pageSize, total: result.total }
            })

            return result
        },

        /** 订单只允许改备注：金额与状态由业务动作（确认/关闭/交付）驱动，其余字段一律忽略 */
        async update(input: SysOrderUpdateDTO): Promise<boolean> {
            await repo.updateById(input.id, { remark: input.remark ?? null })

            log.info('order updated', { order: { action: 'update', id: input.id } })

            return true
        },

        async remove(id: string): Promise<boolean> {
            await assertRemovable([id])
            await repo.remove(id)

            log.info('order removed', { order: { action: 'remove', id } })

            return true
        },

        async batchRemove(ids: string[]): Promise<number> {
            const uniqueIds = Array.from(new Set(ids))

            await assertRemovable(uniqueIds)
            await repo.batchRemove(uniqueIds)

            log.info('order batch removed', { order: { action: 'batchRemove', count: uniqueIds.length } })

            return uniqueIds.length
        },

        /** 确认支付（余额单实扣）：冻结确认 + 置已完成 + 核销券 + 加销量由领域层完成 */
        async confirm(input: SysOrderConfirmDTO) {
            const result = await orders.confirm({
                orderId: input.id,
                operatorId: operatorId()
            })

            log.info('order confirmed', { order: { action: 'confirm', id: input.id } })

            return result
        },

        /** 后台关闭：释放冻结 / 优惠码 / 回滚库存，来源标记为 admin */
        async close(input: SysOrderCloseDTO) {
            const result = await orders.cancel({
                orderId: input.id,
                reason: input.reason ?? null,
                source: 'admin',
                operatorId: operatorId()
            })

            log.info('order closed', { order: { action: 'close', id: input.id } })

            return result
        },

        /** 主动同步在线支付状态（向渠道查询，已支付则按幂等路径推进订单） */
        async sync(input: SysOrderSyncDTO) {
            const result = await orders.sync({
                orderId: input.id,
                operatorId: operatorId()
            })

            log.info('order synced', { order: { action: 'sync', id: input.id } })

            return result
        },

        /** 服务类订单交付（已支付且待交付时才允许） */
        async fulfill(input: SysOrderFulfillDTO) {
            const result = await orders.fulfill({
                orderId: input.id,
                remark: input.remark ?? null,
                operatorId: operatorId()
            })

            log.info('order fulfilled', { order: { action: 'fulfill', id: input.id } })

            return result
        },

        /** 看板统计：区间成交 + 待支付 / 待交付 / 今日 */
        async summary(input: SysOrderSummaryDTO) {
            const result = await orders.summary({
                createdFrom: input.createdFrom ?? null,
                createdTo: input.createdTo ?? null
            })

            log.info('order summary queried', { order: { action: 'summary' } })

            return result
        },

        /**
         * 会员下拉搜索（订单按会员筛选）。
         * scope 由前端按场景传（默认 member = 只列已有会员档案的用户），
         * 订单归属的用户可能还没有档案，因此这里不做强制收敛。
         */
        async userOptions(input: SysMemberUserOptionQueryDTO) {
            const result = await members.searchUserOptions(input)

            log.info('order user options listed', { order: { action: 'userOptions', count: result.length } })

            return result
        },

        // ── 会员自助（protectedProcedure，仅需登录） ───────────────────────

        /** 我的订单（只查自己的单，状态与履约状态可筛选） */
        async myPage(query: SysOrderMyQueryDTO): Promise<OrmPageResp> {
            const user = requireLogin(ctx)
            const { page, pageSize, status, fulfillStatus } = query

            const result = await orders.pageByUser({
                userId: user.id,
                status: status ?? null,
                fulfillStatus: fulfillStatus ?? null,
                page,
                pageSize
            })

            log.info('order my page queried', {
                order: { action: 'myPage', page, pageSize, total: result.total }
            })

            return { ...result, page, pageSize }
        },

        /** 我的订单详情：按订单号读单并校验归属 */
        async myDetail(input: SysOrderNoDTO) {
            const { order } = await requireMyOrder(input.orderNo)

            log.info('order fetched', { order: { action: 'myDetail', id: order.id } })

            return order
        },

        /**
         * 自助下单：userId / operatorId 一律取会话，忽略前端传入；
         * `requestId` 是幂等键，重复提交只会落一单（领域层保证）。
         */
        async myCreate(input: SysOrderCreateDTO) {
            const user = requireLogin(ctx)

            const result = await orders.create({
                ...input,
                userId: user.id,
                operatorId: user.id,
                // 渠道未配 notify_url 时用当前请求 origin 推导回调地址
                origin: getRequestURL(ctx.event).origin
            })

            log.info('order created', { order: { action: 'myCreate', id: result.orderId } })

            return result
        },

        /** 我的订单确认支付（余额单） */
        async myConfirm(input: SysOrderNoDTO) {
            const { user, order } = await requireMyOrder(input.orderNo)

            const result = await orders.confirm({
                orderNo: input.orderNo,
                operatorId: user.id
            })

            log.info('order confirmed', { order: { action: 'myConfirm', id: order.id } })

            return result
        },

        /** 我的订单取消：来源固定 user，原因固定「用户取消」 */
        async myCancel(input: SysOrderNoDTO) {
            const { user, order } = await requireMyOrder(input.orderNo)

            const result = await orders.cancel({
                orderNo: input.orderNo,
                reason: '用户取消',
                source: 'user',
                operatorId: user.id
            })

            log.info('order cancelled', { order: { action: 'myCancel', id: order.id } })

            return result
        },

        /** 我的在线订单主动同步状态 */
        async mySync(input: SysOrderNoDTO) {
            const { user, order } = await requireMyOrder(input.orderNo)

            const result = await orders.sync({
                orderNo: input.orderNo,
                operatorId: user.id
            })

            log.info('order synced', { order: { action: 'mySync', id: order.id } })

            return result
        },

        /**
         * 我的订单支付码：页面刷新后仍能重新看到二维码。
         *
         * 只读**本地**支付单（不发渠道请求），因此可以安全地重复调用；
         * 没有关联支付单（余额单 / 已删除）时返回 null 字段，前端据此隐藏二维码区块。
         */
        async myPayment(input: SysOrderNoDTO) {
            const { order } = await requireMyOrder(input.orderNo)

            if (!order.payOrderId) {
                return {
                    orderNo: order.orderNo,
                    payOrderStatus: null,
                    qrImageUrl: null,
                    qrContent: null,
                    payUrl: null,
                    payAmount: order.payAmount,
                    expireAt: order.expireAt ?? null
                }
            }

            const payOrder = await payOrderService(ctx.db).getById(order.payOrderId)

            log.info('order payment queried', { order: { action: 'myPayment', id: order.id } })

            return {
                orderNo: order.orderNo,
                payOrderStatus: payOrder.status,
                qrImageUrl: payOrder.qrImageUrl ?? null,
                qrContent: payOrder.qrContent ?? null,
                payUrl: payOrder.payUrl ?? null,
                payAmount: payOrder.amount,
                expireAt: payOrder.expireAt ?? order.expireAt ?? null
            }
        },

        // ── 商城（会员自助浏览） ───────────────────────────────────────────

        /**
         * 商城列表：只列上架商品，并按当前会员等级批量算「我的价格」。
         * 等级价在商品域一次查完（避免 N+1），本文件只做卡片字段映射。
         */
        async mallList(query: SysMallQueryDTO): Promise<{
            list: SysMallGoodsRespDTO[]
            total: number
            page: number
            pageSize: number
        }> {
            const user = requireLogin(ctx)
            const [goodsPage, member, levels] = await Promise.all([
                goods.pageEnabled({
                    page: query.page,
                    pageSize: query.pageSize,
                    keyword: query.keyword ?? null,
                    type: query.type ?? null
                }),
                members.getMember(user.id),
                members.listLevels()
            ])
            const levelId = member?.levelId ?? null
            const levelName = levels.find(item => item.id === levelId)?.name ?? null
            const priceMap = await goods.resolvePrices({
                goodsList: goodsPage.list,
                levelId,
                levelName
            })

            const list = goodsPage.list.map(row => {
                const price = priceMap.get(row.id) ?? { unitPrice: row.price, priceSource: 'base' }

                return toMallCard(row, price, price.priceSource === 'level' ? levelName : null)
            })

            log.info('order mall listed', { order: { action: 'mallList', count: list.length } })

            return {
                list,
                total: goodsPage.total,
                page: query.page,
                pageSize: query.pageSize
            }
        },

        /** 商城详情：不存在 / 未上架分别给出明确错误，价格同样由服务端解析 */
        async mallDetail(input: { goodsId: string }): Promise<SysMallGoodsRespDTO> {
            const user = requireLogin(ctx)
            const [row, member, levels] = await Promise.all([
                goods.getById(input.goodsId),
                members.getMember(user.id),
                members.listLevels()
            ])

            if (!row) {
                throw new AppError('module.system.order.goodsNotFound')
            }
            if (Number(row.status ?? 0) !== 1) {
                throw new AppError('module.system.order.goodsOffline')
            }

            const levelId = member?.levelId ?? null
            const levelName = levels.find(item => item.id === levelId)?.name ?? null
            const price = await goods.resolvePrice({ goods: row, levelId })

            log.info('order mall fetched', { order: { action: 'mallDetail', id: input.goodsId } })

            return toMallCard(row, price, price.priceSource === 'level' ? levelName : null)
        }
    }
}

export type SysOrderService = ReturnType<typeof sysOrderService>
