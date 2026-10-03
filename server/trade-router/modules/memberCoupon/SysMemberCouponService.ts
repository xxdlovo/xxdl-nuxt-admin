import { sysMemberCouponRepo } from './SysMemberCouponRepo'
import type { Context } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type {
    SysMemberCouponAddDTO,
    SysMemberCouponDto,
    SysMemberCouponPageQueryDTO,
    SysMemberCouponQueryDTO,
    SysMemberCouponRespDTO,
    SysMemberCouponUpdateDTO,
    SysMemberCouponUsesQueryDTO,
    SysMemberCouponVoidDTO
} from '#shared/system/memberCoupon'
import { randomUuid } from '#shared/utils/uuid'

/**
 * 作废状态码：与 DDL 注释（0 禁用 / 1 启用 / 2 已作废）
 * 及领域层 `domain/member/repo/couponRepo.markVoid` 保持一致。
 */
const COUPON_STATUS_VOID = 2

/** decimal(12,2) 在 drizzle 里读写都是字符串；契约允许表单直接传数字，这里统一成字符串 */
function toDecimalText(value: string | number): string {
    return typeof value === 'number' ? String(value) : value.trim()
}

/**
 * 优惠类型与面值校验：
 * - type 只允许 amount（固定金额）/ rate（折扣率，0.90 表示九折）；
 * - type=rate 时 value 必须落在 (0, 1) 开区间，否则优惠后应付金额会 <= 0。
 */
function assertCouponValue(type: string, value: string | number): void {
    if (type !== 'amount' && type !== 'rate') {
        throw new AppError('module.system.memberCoupon.rateInvalid', { message: type })
    }

    if (type === 'rate') {
        const rate = Number(value)

        if (!Number.isFinite(rate) || rate <= 0 || rate >= 1) {
            throw new AppError('module.system.memberCoupon.rateInvalid', { message: String(value) })
        }
    }
}

/** 列表与详情统一补充派生字段：已用比例（maxUse=0 表示不限次，此时保持 null） */
function withUsedRate(row: SysMemberCouponDto): SysMemberCouponRespDTO {
    const maxUse = Number(row.maxUse ?? 0)
    const usedCount = Number(row.usedCount ?? 0)

    return {
        ...row,
        usedRate: maxUse > 0 ? ((usedCount * 100) / maxUse).toFixed(2) : null
    } as SysMemberCouponRespDTO
}

export function sysMemberCouponService(ctx: Context) {
    const repo = sysMemberCouponRepo(ctx)

    return {
        /** 新增：code 全局唯一 + 类型/面值校验，缺省值兜底与契约 Schema 的 default 一致 */
        async create(data: SysMemberCouponAddDTO): Promise<boolean> {
            const code = data.code.trim()
            const type = data.type ?? 'amount'

            if (await repo.findByCode(code)) {
                throw new AppError('module.system.memberCoupon.codeExists')
            }

            assertCouponValue(type, data.value)

            await repo.create({
                ...data,
                id: randomUuid(),
                code,
                type,
                value: toDecimalText(data.value),
                minAmount: toDecimalText(data.minAmount ?? '0.00'),
                giftAmount: toDecimalText(data.giftAmount ?? '0.00'),
                maxUse: data.maxUse ?? 0,
                perUserLimit: data.perUserLimit ?? 1,
                status: data.status ?? 1,
                // 新码从 0 开始计数，核销只由领域层的条件更新累加
                usedCount: 0
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

        /**
         * 修改：code 一经生成不可变更（契约约定由 Service 忽略），其余字段按新值覆盖，
         * 并重新做一次类型/面值校验（type 与 value 都在修改范围内）。
         */
        async updateById(id: string, data: SysMemberCouponUpdateDTO): Promise<boolean> {
            const row = await repo.getById(id)

            if (!row) {
                throw new AppError('common.notExist')
            }

            const { id: _id, code: _code, ...rest } = data
            const type = rest.type ?? 'amount'
            const value = rest.value ?? row.value

            assertCouponValue(type, value)

            await repo.updateById(id, {
                ...rest,
                type,
                value: toDecimalText(value),
                minAmount: toDecimalText(rest.minAmount ?? '0.00'),
                giftAmount: toDecimalText(rest.giftAmount ?? '0.00'),
                maxUse: rest.maxUse ?? 0,
                perUserLimit: rest.perUserLimit ?? 1
            })

            return true
        },

        async getOne(req: SysMemberCouponQueryDTO): Promise<SysMemberCouponRespDTO> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return withUsedRate(pojo as SysMemberCouponDto)
        },

        async getById(id: string): Promise<SysMemberCouponRespDTO> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return withUsedRate(pojo as SysMemberCouponDto)
        },

        async page(req: SysMemberCouponPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, createdFrom, createdTo, ...dto } = req
            const result = await repo.pageWithRange(page, pageSize, dto, { createdFrom, createdTo })

            return {
                ...result,
                list: (result.list as SysMemberCouponDto[]).map(withUsedRate)
            }
        },

        /**
         * 作废：status 置 2，只能用一次 —— 已作废的行再次调用直接返回成功（幂等），
         * 不重复写库也不报错；remark 作为作废原因写入备注，未传则保留原备注。
         */
        async voidCoupon(data: SysMemberCouponVoidDTO): Promise<boolean> {
            const row = await repo.getById(data.id)

            if (!row) {
                throw new AppError('common.notExist')
            }

            if (Number(row.status) === COUPON_STATUS_VOID) {
                return true
            }

            const reason = typeof data.remark === 'string' ? data.remark.trim() : ''

            await repo.updateById(data.id, reason
                ? { status: COUPON_STATUS_VOID, remark: reason }
                : { status: COUPON_STATUS_VOID })

            return true
        },

        /**
         * 使用记录反查：这张券被谁用了、用在哪个业务单上。
         *
         * 先确认券存在（否则前端传错 id 只会得到空列表，看不出是参数问题）；
         * 返回核销记录 + 使用人昵称/账号/手机号，按创建时间倒序分页。
         */
        async uses(req: SysMemberCouponUsesQueryDTO) {
            const row = await repo.getById(req.couponId)

            if (!row) {
                throw new AppError('common.notExist')
            }

            return await repo.pageUses(req.couponId, req.page, req.pageSize)
        }
    }
}
