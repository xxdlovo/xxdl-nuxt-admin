import { z } from 'zod'
import { SysMemberCouponBaseSchema } from './common'
import { ApiRequestSchema } from '#shared/types/common'

/**
 * 新增优惠码。code 由管理端显式指定（唯一索引冲突由 Service 转为业务错误），
 * 也可以留空由后端按批次生成，这里统一收敛成必填以保持表单可校验。
 */
export const SysMemberCouponAddSchema =
    SysMemberCouponBaseSchema.pick({
        code: true,
        name: true,
        type: true,
        value: true,
        minAmount: true,
        scene: true,
        giftAmount: true,
        validFrom: true,
        validTo: true,
        maxUse: true,
        perUserLimit: true,
        batchNo: true,
        status: true,
        remark: true,
    }).extend({
        id: SysMemberCouponBaseSchema.shape.id.nonoptional(),
        code: z.string().min(1, 'form.required').max(32, 'form.required'),
        name: z.string().min(1, 'form.required').max(50, 'form.required'),
        type: z.string().max(20).default('amount'),
        value: z.union([z.string(), z.number()]),
        minAmount: z.union([z.string(), z.number()]).default('0.00'),
        scene: z.string().max(20).default('all'),
        giftAmount: z.union([z.string(), z.number()]).default('0.00'),
        validFrom: z.string().max(19).nullish(),
        validTo: z.string().max(19).nullish(),
        maxUse: z.number().int().min(0).default(0),
        perUserLimit: z.number().int().min(0).default(1),
        batchNo: z.string().max(50).nullish(),
        status: z.number().default(1),
        remark: z.string().max(255).nullish(),
    })
export type SysMemberCouponAddDTO = z.infer<typeof SysMemberCouponAddSchema>

// 修改：在新增基础上让 id 必填；code 一经生成不可变更，由 Service 忽略
export const SysMemberCouponUpdateSchema = SysMemberCouponAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysMemberCouponUpdateDTO = z.infer<typeof SysMemberCouponUpdateSchema>

/**
 * 作废优惠码：status 置 2（与 DDL 注释、couponRepo.markVoid 一致），已使用次数不回退。
 * remark 作为作废原因写入备注。
 */
export const SysMemberCouponVoidSchema = z.object({
    id: z.string().nonempty('form.id.required'),
    remark: z.string().max(255).nullish(),
})
export type SysMemberCouponVoidDTO = z.infer<typeof SysMemberCouponVoidSchema>

/**
 * 查询条件。createdFrom / createdTo 不是表字段：
 * buildWhereBySchema 会自动跳过，由 Repo 的 pageWithRange 用区间条件消费。
 */
export const SysMemberCouponQuerySchema = SysMemberCouponBaseSchema.pick({
    id: true,
    code: true,
    name: true,
    type: true,
    scene: true,
    batchNo: true,
    status: true,
}).extend({
    createdFrom: z.string().nullish(),
    createdTo: z.string().nullish(),
})
export type SysMemberCouponQueryDTO = z.infer<typeof SysMemberCouponQuerySchema>

// 分页查询：查询条件 + 分页参数
export const SysMemberCouponPageQuerySchema =
    SysMemberCouponQuerySchema.extend(ApiRequestSchema.shape)
export type SysMemberCouponPageQueryDTO = z.infer<typeof SysMemberCouponPageQuerySchema>

/**
 * 使用记录反查（谁用了这张券）：按 couponId 分页列出核销记录。
 * 权限沿用 `system:memberCoupon:list`。
 */
export const SysMemberCouponUsesQuerySchema = z
    .object({
        couponId: z.string().min(1, 'form.required').max(36, 'form.required'),
    })
    .extend(ApiRequestSchema.shape)
export type SysMemberCouponUsesQueryDTO = z.infer<typeof SysMemberCouponUsesQuerySchema>
