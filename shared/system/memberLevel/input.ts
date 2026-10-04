import { z } from 'zod'
import { SysMemberLevelBaseSchema } from './common'
import { ApiRequestSchema } from '#shared/types/common'

// 新增
export const SysMemberLevelAddSchema = SysMemberLevelBaseSchema.pick({
    code: true,
    name: true,
    sortOrder: true,
    benefit: true,
    price: true,
    durationDays: true,
    isDefault: true,
    isLongTerm: true,
    status: true,
    remark: true,
}).extend({
    id: SysMemberLevelBaseSchema.shape.id.nonoptional(),
    code: z.string().min(1, 'form.required').max(50, 'form.required'),
    name: z.string().min(1, 'form.required').max(50, 'form.required'),
    sortOrder: z.number().int().default(0),
    /** 等级权益说明，展示用文本 */
    benefit: z.string().max(500).nullish(),
    /**
     * 等级售价（元），decimal(12,2)；入参兼容 string | number（表单直接传数字），
     * 出参统一归一化为字符串——因为列是 NOT NULL 且 drizzle 按字符串读写，
     * Service 会把本 DTO 直接展开进 insert，故这里用 transform 收敛类型。0 表示免费等级。
     *
     * 业务规则（由 Service 校验，不在此处强制）：
     * - price > 0 时 isLongTerm 必须为 0，且 durationDays >= 1；
     * - price = 0 时 durationDays 可为 0（= 不设期限 / 长期）。
     * isLongTerm=1 仅允许 price=0 的等级设置（该等级会员永不过期）。
     */
    price: z.union([z.string(), z.number()]).transform(value => String(value)).optional(),
    /** 购买一次的有效天数，int >= 0；0 表示不设期限（长期等级） */
    durationDays: z.number().int().min(0).optional(),
    /** 是否默认等级：0 否 / 1 是（全局唯一，新用户注册自动分配且永不过期；由 Service 保证唯一） */
    isDefault: z.number().int().min(0).max(1).optional(),
    /** 是否长期等级：0 否 / 1 是（仅 price=0 可设） */
    isLongTerm: z.number().int().min(0).max(1).optional(),
    status: z.number().default(1),
    remark: z.string().max(255).nullish(),
})
export type SysMemberLevelAddDTO = z.infer<typeof SysMemberLevelAddSchema>

// 修改：在新增基础上让 id 必填
export const SysMemberLevelUpdateSchema = SysMemberLevelAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysMemberLevelUpdateDTO = z.infer<typeof SysMemberLevelUpdateSchema>

// 查询条件
export const SysMemberLevelQuerySchema = SysMemberLevelBaseSchema.pick({
    id: true,
    code: true,
    name: true,
    sortOrder: true,
    benefit: true,
    status: true,
    remark: true,
})
export type SysMemberLevelQueryDTO = z.infer<typeof SysMemberLevelQuerySchema>

// 分页查询：查询条件 + 分页参数
export const SysMemberLevelPageQuerySchema =
    SysMemberLevelQuerySchema.extend(ApiRequestSchema.shape)
export type SysMemberLevelPageQueryDTO = z.infer<typeof SysMemberLevelPageQuerySchema>
