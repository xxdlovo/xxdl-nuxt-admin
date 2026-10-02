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
    // 下单 / 查询 / 关闭等涉及渠道交互的逻辑全部收敛在领域层
    const pay = payOrderService(ctx.db)

    return {
        /** 手工补录（正常下单走 sysPayTest.create） */
        async create(data: SysPayOrderAddDTO): Promise<boolean> {
            await repo.create({
                ...data,
                id: randomUuid(),
                amount: normalizeAmount(data.amount),
                notifyCount: 0
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
        async updateById(id: string, data: SysPayOrderUpdateDTO): Promise<boolean> {
            await repo.updateById(id, {
                ...data,
                amount: normalizeAmount(data.amount)
            })
            return true
        },
        async getOne(req: SysPayOrderQueryDTO): Promise<SysPayOrderDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo as SysPayOrderDto
        },
        async getById(id: string): Promise<SysPayOrderDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo as SysPayOrderDto
        },
        async page(req: SysPayOrderPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, amountMin, amountMax, createdFrom, createdTo, ...dto } = req

            return await repo.pageWithRange(page, pageSize, dto, {
                amountMin,
                amountMax,
                createdFrom,
                createdTo
            })
        },
        async list(dto: SysPayOrderQueryDTO): Promise<SysPayOrderDto[]> {
            const rows = await repo.listRecent(dto)
            return rows as SysPayOrderDto[]
        },

        /** 主动查询渠道并推进本地状态（支付记录页的「同步状态」） */
        async syncStatus(id: string) {
            return await pay.queryPayment(id, {
                operatorId: ctx.user?.id ?? null
            })
        },

        /** 本地关闭未支付订单 */
        async close(id: string) {
            return await pay.closePayment(id, {
                operatorId: ctx.user?.id ?? null
            })
        },

        /** 某笔订单的回调 / 查询日志时间线 */
        async notifyLogs(orderId: string) {
            return await repo.listNotifyLogsByOrderId(orderId)
        }
    }
}
