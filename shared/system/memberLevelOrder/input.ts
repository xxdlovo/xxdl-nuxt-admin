import { z } from 'zod'
import { SysMemberLevelOrderBaseSchema } from './common'
import { ApiRequestSchema } from '#shared/types/common'

/**
 * 开通会员（购买 / 续费等级）。
 *
 * - `payMode` 只允许用户选 `balance` / `online` 两种；价格为 0 的免费等级由服务端
 *   自行写入 `free`（用户不感知支付），因此这里**不包含** `free`；
 * - `requestId` 是幂等键：前端每次提交生成，服务端据此防止连点/重试造成重复开单。
 *   单据级由 `uk_member_level_order_request(request_id)` 唯一键保证「同一 requestId 只落一单」
 *   （命中即复用原单并返回 `reused = true`）；余额支付还会把它拼进冻结业务号
 *   （`mlv:{requestId}`，与 `biz_no varchar(64)` 对齐），让资金层同样幂等，故上限 36；
 * - 等级价与时长以服务端的 sys_member_level 为准，前端不传金额。
 */
export const SysMemberLevelOpenSchema = z.object({
    levelId: z.string().min(1, 'form.required').max(36, 'form.required'),
    payMode: z.enum(['balance', 'online']),
    /** 幂等键：命中唯一键 uk_member_level_order_request 时复用原单（上限 36） */
    requestId: z.string().min(1, 'form.required').max(36, 'form.required'),
})
export type SysMemberLevelOpenDTO = z.infer<typeof SysMemberLevelOpenSchema>

/**
 * 按商户单号定位开通单：**状态查询与主动同步共用**。
 * 归属校验在服务端按当前登录用户做，前端只传单号。
 */
export const SysMemberLevelOrderNoSchema = z.object({
    outTradeNo: z.string().min(1, 'form.required').max(64, 'form.required'),
})
export type SysMemberLevelOrderNoDTO = z.infer<typeof SysMemberLevelOrderNoSchema>

/**
 * 后台「会员开通记录」查询条件（页面 `/system/member-level-order`）。
 * outTradeNo 走 `like`（沿用 Base Schema 的 meta）；userId / levelId / status / payMode 走等值
 * （userId 由会员选择器给出确定 id，不做模糊）。
 * `createdFrom` / `createdTo` 不是表字段，由 Repo 用创建时间区间条件消费。
 */
export const SysMemberLevelOrderQuerySchema = SysMemberLevelOrderBaseSchema.pick({
    outTradeNo: true,
    userId: true,
    levelId: true,
    status: true,
    payMode: true,
}).extend({
    /** 开通时间区间起点，格式 YYYY-MM-DD HH:mm:ss（非表字段，由 Repo 消费） */
    createdFrom: z.string().max(30).nullish(),
    /** 开通时间区间终点，格式 YYYY-MM-DD HH:mm:ss（非表字段，由 Repo 消费） */
    createdTo: z.string().max(30).nullish(),
})
export type SysMemberLevelOrderQueryDTO = z.infer<typeof SysMemberLevelOrderQuerySchema>

/** 后台分页查询：查询条件 + 分页参数 */
export const SysMemberLevelOrderPageQuerySchema =
    SysMemberLevelOrderQuerySchema.extend(ApiRequestSchema.shape)
export type SysMemberLevelOrderPageQueryDTO = z.infer<typeof SysMemberLevelOrderPageQuerySchema>

/**
 * 权限码（与 `doc/main/mysql-menu-member-level-order.sql` 的菜单行一一对应）：
 * - `system:memberLevelOrder:list`  查询（列表 / 详情）
 * - `system:memberLevelOrder:edit`  关闭未支付单
 * - `system:memberLevelOrder:query` 同步支付状态（有副作用，单独授权）
 * - `system:memberLevelOrder:del`   删除
 * 这里只用注释固定口径，不引入枚举常量：后端路由按字面量声明权限码，避免两处各定义一份。
 */
