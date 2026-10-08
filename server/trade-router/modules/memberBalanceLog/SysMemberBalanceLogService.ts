//#server/trade-router/modules/memberBalanceLog
import { useLogger } from 'evlog'
/**
 * 余额流水模块 Service。
 *
 * 设计取舍：**流水是资金凭证，不提供新增/编辑/删除**（`sys_member_balance_log` 只能由
 * 领域层写入）。菜单里预置的 `:edit` / `:del` 权限码当前没有对应接口，属于预留。
 *
 * 提供的能力：
 * - 列表 / 详情（带数据权限）
 * - 区间汇总（对账看板）
 * - 一致性校验（钱包余额 vs 流水净额）
 * - CSV 导出（tRPC 返回文本，前端用 Blob 下载）
 * - 未到账充值补偿（幂等）
 */
import { AppError } from '#server/utils/appError'
import type { Context } from '#server/trpc/context'
import type { OrmPageResp } from '#server/utils/ApiResp'
import { buildCsv, buildCsvFilename } from '#shared/utils/csv'
import { walletService } from '#server/trade-router/domain/wallet/WalletService'
import { memberService } from '#server/trade-router/domain/member/MemberService'
import { rechargeService } from '#server/trade-router/domain/wallet/RechargeService'
import { addMoney } from '#server/trade-router/domain/wallet/utils'
import type {
    SysMemberBalanceLogExportDTO,
    SysMemberBalanceLogPageQueryDTO,
    SysMemberBalanceLogQueryDTO,
    SysMemberBalanceLogReconcileDTO,
    SysMemberBalanceLogRechargeRetryDTO,
    SysMemberBalanceLogSummaryDTO
} from '#shared/system/memberBalanceLog'
import type { SysMemberUserOptionQueryDTO } from '#shared/system/member'
import { sysMemberBalanceLogRepo } from './SysMemberBalanceLogRepo'

/** 导出上限：超过则提示收窄条件（避免 tRPC 响应体过大） */
const MAX_EXPORT_ROWS = 50000

/** 账户 / 方向 / 业务类型的中文文案（导出与看板共用） */
const ACCOUNT_LABEL: Record<string, string> = {
    recharge: '充值金',
    gift: '赠送金'
}

const DIRECTION_LABEL: Record<string, string> = {
    in: '收入',
    out: '支出'
}

const BIZ_TYPE_LABEL: Record<string, string> = {
    recharge: '充值到账',
    register_bonus: '注册赠金',
    gift_system: '系统赠送',
    gift_campaign: '活动赠送',
    adjust: '手工调账',
    consume_confirm: '消费实扣',
    level_open: '等级购买',
    gift_expire: '赠送金过期'
}

export function sysMemberBalanceLogService(ctx: Context) {
    const repo = sysMemberBalanceLogRepo(ctx)
    // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
    const log = useLogger(ctx.event, 'server/trade-router/memberBalanceLog')
    const wallet = walletService(ctx.db)
    const members = memberService(ctx.db)
    const recharges = rechargeService(ctx.db)

    const operatorId = () => ctx.user?.id ?? null

    /** 查询 DTO → Repo 入参（时间区间单独传，避免污染表字段条件） */
    function splitRange(dto: SysMemberBalanceLogQueryDTO) {
        const { createdFrom, createdTo, ...rest } = dto

        return {
            dto: rest as Record<string, unknown>,
            range: { createdFrom: createdFrom ?? null, createdTo: createdTo ?? null }
        }
    }

    return {
        async getOne(req: SysMemberBalanceLogQueryDTO) {
            const pojo = await repo.getOne(req as Record<string, unknown>)

            if (!pojo) throw new AppError('common.notExist')

            log.info('memberBalanceLog fetched', { memberBalanceLog: { action: 'getOne' } })
            return pojo
        },

        async getById(id: string) {
            const pojo = await repo.getById(id)

            if (!pojo) throw new AppError('common.notExist')

            log.info('memberBalanceLog fetched', { memberBalanceLog: { action: 'getById', id } })
            return pojo
        },

        async page(req: SysMemberBalanceLogPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            const { dto: filters, range } = splitRange(dto as SysMemberBalanceLogQueryDTO)

            const result = await repo.pageWithRange(page, pageSize, filters, range)
            log.info('memberBalanceLog page queried', {
                memberBalanceLog: { action: 'page', page, pageSize, total: result.total }
            })

            return result
        },

        async list(dto: SysMemberBalanceLogQueryDTO) {
            const { dto: filters, range } = splitRange(dto)

            const rows = await repo.listWithRange(filters, range, 200)
            log.info('memberBalanceLog listed', { memberBalanceLog: { action: 'list', count: rows.length } })

            return rows
        },

        /**
         * 区间汇总：按业务类型聚合，并补一个总计，供对账页看板使用。
         *
         * `pendingRechargeCount` 只是「待补偿充值条数」这一项轻量计数（一次 COUNT(*)），
         * 让流水页每次加载/搜索都能显示待补偿数量，而不必再并发调用全量对账
         * `reconcile`（那会对全部钱包行 + 整张流水表做全量比对）。
         */
        async summary(input: SysMemberBalanceLogSummaryDTO) {
            const [rows, pendingRechargeCount] = await Promise.all([
                repo.sumByBizType({
                    createdFrom: input.createdFrom ?? null,
                    createdTo: input.createdTo ?? null
                }),
                recharges.countPending()
            ])

            let totalIn = '0.00'
            let totalOut = '0.00'
            const items = rows.map(row => {
                const total = String(row.total ?? '0.00')

                if (row.direction === 'in') {
                    totalIn = addMoney(totalIn, total)
                } else {
                    totalOut = addMoney(totalOut, total)
                }

                return {
                    bizType: row.bizType,
                    direction: row.direction,
                    label: BIZ_TYPE_LABEL[row.bizType] ?? row.bizType,
                    total
                }
            })

            log.info('memberBalanceLog summary queried', {
                memberBalanceLog: { action: 'summary', count: items.length }
            })

            return {
                items,
                totalIn,
                totalOut,
                netTotal: addMoney(totalIn, `-${totalOut}`),
                pendingRechargeCount
            }
        },

        /**
         * 一致性校验：钱包余额 vs 流水净额。
         * 传了 userId 只校验该会员，否则全量分组校验（一次查询）。
         */
        async reconcile(input: SysMemberBalanceLogReconcileDTO) {
            const [consistency, pending] = await Promise.all([
                wallet.assertConsistency({ userId: input.userId ?? null }),
                recharges.countPending()
            ])

            log.info('memberBalanceLog reconcile checked', {
                memberBalanceLog: {
                    action: 'reconcile',
                    checkedCount: consistency.checkedUsers,
                    mismatchCount: consistency.mismatches.length
                }
            })

            return {
                checkDate: input.checkDate ?? null,
                checkedCount: consistency.checkedUsers,
                mismatches: consistency.mismatches,
                pendingRechargeCount: pending
            }
        },

        /** 未到账充值补偿（幂等） */
        async rechargeRetry(input: SysMemberBalanceLogRechargeRetryDTO) {
            // 单次补偿上限固定，避免一次请求扫过多数据（需要更多时可重复点击）
            const result = await recharges.retryPending(50, operatorId())
            log.info('memberBalanceLog recharge retried', {
                memberBalanceLog: { action: 'rechargeRetry', count: result.scanned }
            })

            return result
        },

        /**
         * 会员下拉搜索（流水按会员筛选）。
         * 流水只可能属于有档案的会员，这里固定 scope=member。
         */
        async userOptions(input: SysMemberUserOptionQueryDTO) {
            const list = await members.searchUserOptions({
                keyword: input.keyword ?? null,
                limit: input.limit,
                scope: 'member'
            })
            log.info('memberBalanceLog user options listed', {
                memberBalanceLog: { action: 'userOptions', count: list.length }
            })

            return list
        },

        /** CSV 导出：超过上限直接报错，避免前端拿到截断的数据还以为是全量 */
        async exportCsv(input: SysMemberBalanceLogExportDTO) {
            const limit = Math.min(input.limit ?? 5000, MAX_EXPORT_ROWS)
            const { dto: filters, range } = splitRange(input as SysMemberBalanceLogQueryDTO)

            const rows = await repo.listWithRange(filters, range, limit + 1)

            if (rows.length > limit) {
                throw new AppError('module.system.memberBalanceLog.exportTooLarge', { message: String(limit) })
            }

            const content = buildCsv(
                ['流水ID', '会员用户ID', '账户', '方向', '金额', '发生前余额', '发生后余额', '业务类型', '业务单号', '操作人', '原因', '备注', '发生时间'],
                rows.map(row => [
                    row.id,
                    row.userId,
                    ACCOUNT_LABEL[row.account] ?? row.account,
                    DIRECTION_LABEL[row.direction] ?? row.direction,
                    row.amount,
                    row.balanceBefore,
                    row.balanceAfter,
                    BIZ_TYPE_LABEL[row.bizType] ?? row.bizType,
                    row.bizNo,
                    row.operatorId ?? '',
                    row.reason ?? '',
                    row.remark ?? '',
                    row.createdAt
                ])
            )

            log.info('memberBalanceLog exported', {
                memberBalanceLog: { action: 'exportCsv', count: rows.length }
            })

            return {
                filename: buildCsvFilename('member-balance-log'),
                content
            }
        }
    }
}

export type SysMemberBalanceLogService = ReturnType<typeof sysMemberBalanceLogService>
