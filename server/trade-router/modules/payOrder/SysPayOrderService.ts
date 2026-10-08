import { useLogger } from 'evlog'
import { sysPayOrderRepo } from './SysPayOrderRepo'
import type { Context } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import { payOrderService } from '#server/trade-router/domain/pay/PayOrderService'
import { normalizeAmount } from '#server/trade-router/domain/pay/utils'
import type {
    SysPayOrderAddDTO,
    SysPayOrderDto,
    SysPayOrderPageQueryDTO,
    SysPayOrderQueryDTO,
    SysPayOrderUpdateDTO
} from '#shared/system/payOrder'
import { randomUuid } from '#shared/utils/uuid'

export function sysPayOrderService(ctx: Context) {
    const repo = sysPayOrderRepo(ctx)
    // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
    const log = useLogger(ctx.event, 'server/trade-router/payOrder')
    // 下单 / 查询 / 关闭等涉及渠道交互的逻辑全部收敛在领域层
    const pay = payOrderService(ctx.db)

    return {
        /** 手工补录（正常下单走 sysPayTest.create） */
        async create(data: SysPayOrderAddDTO): Promise<boolean> {
            const id = randomUuid()
            await repo.create({
                ...data,
                id,
                amount: normalizeAmount(data.amount),
                notifyCount: 0
            })
            log.info('payOrder created', { payOrder: { action: 'create', id } })
            return true
        },
        async remove(id: string): Promise<boolean> {
            await repo.remove(id)
            log.info('payOrder removed', { payOrder: { action: 'remove', id } })
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            log.info('payOrder batch removed', { payOrder: { action: 'batchRemove', count: ids.length } })
            return ids.length
        },
        async updateById(id: string, data: SysPayOrderUpdateDTO): Promise<boolean> {
            await repo.updateById(id, {
                ...data,
                amount: normalizeAmount(data.amount)
            })
            log.info('payOrder updated', { payOrder: { action: 'update', id } })
            return true
        },
        async getOne(req: SysPayOrderQueryDTO): Promise<SysPayOrderDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            log.info('payOrder fetched', { payOrder: { action: 'getOne' } })
            return pojo as SysPayOrderDto
        },
        async getById(id: string): Promise<SysPayOrderDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            log.info('payOrder fetched', { payOrder: { action: 'getById', id } })
            return pojo as SysPayOrderDto
        },
        async page(req: SysPayOrderPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, amountMin, amountMax, createdFrom, createdTo, ...dto } = req

            const result = await repo.pageWithRange(page, pageSize, dto, {
                amountMin,
                amountMax,
                createdFrom,
                createdTo
            })

            log.info('payOrder page queried', {
                payOrder: { action: 'page', page, pageSize, total: result.total }
            })

            return result
        },
        async list(dto: SysPayOrderQueryDTO): Promise<SysPayOrderDto[]> {
            const rows = await repo.listRecent(dto)
            log.info('payOrder listed', { payOrder: { action: 'list', count: rows.length } })
            return rows as SysPayOrderDto[]
        },

        /** 主动查询渠道并推进本地状态（支付记录页的「同步状态」） */
        async syncStatus(id: string) {
            const result = await pay.queryPayment(id, {
                operatorId: ctx.user?.id ?? null
            })
            log.info('payOrder status synced', { payOrder: { action: 'syncStatus', id } })
            return result
        },

        /** 本地关闭未支付订单 */
        async close(id: string) {
            const result = await pay.closePayment(id, {
                operatorId: ctx.user?.id ?? null
            })
            log.info('payOrder closed', { payOrder: { action: 'close', id } })
            return result
        },

        /** 某笔订单的回调 / 查询日志时间线 */
        async notifyLogs(orderId: string) {
            const list = await repo.listNotifyLogsByOrderId(orderId)
            log.info('payOrder notify logs queried', {
                payOrder: { action: 'notifyLogs', id: orderId, count: list.length }
            })
            return list
        }
    }
}
