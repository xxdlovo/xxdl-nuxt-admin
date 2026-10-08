//#server/trade-router/modules/memberLevelOrder
import { useLogger } from 'evlog'
/**
 * 会员开通单模块 Service（后台管理）。
 *
 * 分层：本文件只做「参数收敛 + 数据权限 + 领域调用」，状态机与资金一律走领域层
 * `domain/member/MemberLevelOrderService.ts`（关闭 = 释放冻结 + 置 CL + best-effort 关渠道支付单）。
 *
 * 能力：
 * - `page` / `getById`：后台开通记录列表与详情（联表带昵称 / 账号 / 手机号）；
 * - `close`：关闭未支付单据（仅 `WP`，`CL` 幂等成功，其余状态报错）；
 * - `sync`：主动查渠道推进状态（与会员自助 `myLevelOrderSync` 同一领域方法，只是操作者不同）；
 * - `remove` / `batchRemove`：只允许删除 `CL` / `FL`（照订单模块的 `assertRemovable` 保护）。
 */
import { sysMemberLevelOrderRepo } from './SysMemberLevelOrderRepo'
import type { Context } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'
import { memberLevelOrderService } from '#server/trade-router/domain/member/MemberLevelOrderService'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type {
    SysMemberLevelOrderPageQueryDTO,
    SysMemberLevelOrderStatusRespDTO
} from '#shared/system/memberLevelOrder'

/** 已关闭 */
const STATUS_CLOSED = 'CL'
/** 发起失败 */
const STATUS_FAILED = 'FL'
/** 待支付 */
const STATUS_PENDING = 'WP'

export function sysMemberLevelOrderService(ctx: Context) {
    const repo = sysMemberLevelOrderRepo(ctx)
    // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
    const log = useLogger(ctx.event, 'server/trade-router/memberLevelOrder')
    // 关闭 / 同步：状态机与资金在领域层，模块层不改状态、不动余额
    const orders = memberLevelOrderService(ctx.db)

    const operatorId = () => ctx.user?.id ?? null

    /**
     * 删除保护：只有已关闭（CL）/ 发起失败（FL）的单据可以删除。
     * - 待支付（WP）要先关闭：否则会留下悬挂的冻结单与可支付的二维码；
     * - 已生效（OD）是等级与资金的凭证，不允许删除。
     */
    async function assertRemovable(ids: string[]) {
        for (const id of ids) {
            const row = await repo.getById(id)

            if (!row) {
                throw new AppError('common.notExist')
            }

            if (row.status !== STATUS_CLOSED && row.status !== STATUS_FAILED) {
                throw new AppError('module.system.memberLevelOrder.deleteNotAllowed')
            }
        }
    }

    return {
        async page(req: SysMemberLevelOrderPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, createdFrom, createdTo, ...dto } = req

            const result = await repo.pageWithProfile(page, pageSize, dto as Record<string, unknown>, {
                createdFrom: createdFrom ?? null,
                createdTo: createdTo ?? null
            })

            log.info('memberLevelOrder page queried', {
                memberLevelOrder: { action: 'page', page, pageSize, total: result.total }
            })

            return result
        },

        async getById(id: string) {
            const profile = await repo.getProfileById(id)

            if (!profile) {
                throw new AppError('common.notExist')
            }

            log.info('memberLevelOrder fetched', { memberLevelOrder: { action: 'getById', id } })

            return profile
        },

        /**
         * 关闭开通单：仅 `WP` 可关（`CL` 幂等返回成功、其余状态报业务错误）。
         * 关闭原因写 `fail_reason`；领域层会一并释放仍处冻结态的冻结单并尽力关闭渠道支付单。
         */
        async close(input: { id: string; reason?: string | null }): Promise<boolean> {
            const row = await repo.getById(input.id)

            if (!row) {
                throw new AppError('common.notExist')
            }

            if (row.status === STATUS_CLOSED) {
                return true
            }

            if (row.status !== STATUS_PENDING) {
                throw new AppError('module.system.memberLevelOrder.notClosable')
            }

            const result = await orders.close({
                outTradeNo: row.outTradeNo,
                reason: input.reason ?? '后台关闭',
                operatorId: operatorId()
            })

            log.info('memberLevelOrder closed', { memberLevelOrder: { action: 'close', id: input.id } })

            return result.closed || result.reused
        },

        /** 主动同步支付状态：向渠道查询，已支付则按幂等路径生效（有副作用，单独权限码） */
        async sync(input: { id: string }): Promise<SysMemberLevelOrderStatusRespDTO> {
            const row = await repo.getById(input.id)

            if (!row) {
                throw new AppError('common.notExist')
            }

            const result = await orders.sync({
                outTradeNo: row.outTradeNo,
                operatorId: operatorId()
            })

            log.info('memberLevelOrder synced', { memberLevelOrder: { action: 'sync', id: input.id } })

            return result
        },

        async remove(id: string): Promise<boolean> {
            await assertRemovable([id])
            await repo.remove(id)

            log.info('memberLevelOrder removed', { memberLevelOrder: { action: 'remove', id } })

            return true
        },

        async batchRemove(ids: string[]): Promise<number> {
            const uniqueIds = Array.from(new Set(ids))

            if (uniqueIds.length === 0) {
                return 0
            }

            await assertRemovable(uniqueIds)
            await repo.batchRemove(uniqueIds)

            log.info('memberLevelOrder batch removed', {
                memberLevelOrder: { action: 'batchRemove', count: uniqueIds.length }
            })

            return uniqueIds.length
        }
    }
}

export type SysMemberLevelOrderService = ReturnType<typeof sysMemberLevelOrderService>
