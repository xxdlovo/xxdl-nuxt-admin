import { z } from 'zod'
import { SysMemberLevelOrderBaseSchema } from './common'

/**
 * 会员开通单响应（单据本体 + 联表展示字段）。
 * 金额保持 decimal(12,2) 的字符串形态；`payMode` / `status` 与表内取值一一对应
 * （`payMode` 含服务端写入的 `free` / `manual`，前端只多一个展示文案，不出现新按钮）。
 * userId 对应的会员信息由后台列表/详情联表带出，会员侧接口不返回。
 * 后台列表页 `/system/member-level-order` 需要 userId / createdAt / createdBy / updatedBy /
 * payOrderId / payChannelCode 等列，故这些字段一并保留（`isDeleted` 不对外暴露）。
 * 详情弹窗的「关联支付单」字段（`linkedPay*`）**不在本 Schema 内**：按充值单的既有做法由
 * Service/Repo 联表 `sys_pay_order` 带出，页面按可选字段消费（见页面侧 types.ts）。
 */
export const SysMemberLevelOrderRespSchema = z.object({
    id: SysMemberLevelOrderBaseSchema.shape.id,
    outTradeNo: SysMemberLevelOrderBaseSchema.shape.outTradeNo,
    requestId: SysMemberLevelOrderBaseSchema.shape.requestId,
    userId: SysMemberLevelOrderBaseSchema.shape.userId,
    levelId: SysMemberLevelOrderBaseSchema.shape.levelId,
    levelName: SysMemberLevelOrderBaseSchema.shape.levelName,
    durationDays: SysMemberLevelOrderBaseSchema.shape.durationDays,
    priceAmount: SysMemberLevelOrderBaseSchema.shape.priceAmount,
    payAmount: SysMemberLevelOrderBaseSchema.shape.payAmount,
    payMode: SysMemberLevelOrderBaseSchema.shape.payMode,
    status: SysMemberLevelOrderBaseSchema.shape.status,
    freezeId: SysMemberLevelOrderBaseSchema.shape.freezeId,
    payOrderId: SysMemberLevelOrderBaseSchema.shape.payOrderId,
    payChannelCode: SysMemberLevelOrderBaseSchema.shape.payChannelCode,
    startAt: SysMemberLevelOrderBaseSchema.shape.startAt,
    endAt: SysMemberLevelOrderBaseSchema.shape.endAt,
    paidAt: SysMemberLevelOrderBaseSchema.shape.paidAt,
    effectiveAt: SysMemberLevelOrderBaseSchema.shape.effectiveAt,
    expireAt: SysMemberLevelOrderBaseSchema.shape.expireAt,
    failReason: SysMemberLevelOrderBaseSchema.shape.failReason,
    remark: SysMemberLevelOrderBaseSchema.shape.remark,
    createdAt: SysMemberLevelOrderBaseSchema.shape.createdAt,
    updatedAt: SysMemberLevelOrderBaseSchema.shape.updatedAt,
    /** 展示字段：操作人ID（后台详情页展示；自助接口不返回） */
    createdBy: SysMemberLevelOrderBaseSchema.shape.createdBy,
    updatedBy: SysMemberLevelOrderBaseSchema.shape.updatedBy,
    /** 展示字段：关联 sys_user.nickname（会员自助接口不返回） */
    nickname: z.string().nullish(),
    /** 展示字段：关联 sys_user.username（会员自助接口不返回） */
    username: z.string().nullish(),
    /** 展示字段：关联 sys_user.phone（会员自助接口不返回） */
    phone: z.string().nullish(),
})
export type SysMemberLevelOrderRespDTO = z.infer<typeof SysMemberLevelOrderRespSchema>

/**
 * 开通会员结果。
 *
 * - 余额支付 / 0 元免费等级：`status` 直接是 `OD`，二维码三件套（`qrImageUrl` / `qrContent` / `payUrl`）
 *   为 null，前端不需要唤起收银台；`payMode` 为 `balance` 或 `free`；
 * - 在线支付：`status` 为 `WP`，二维码三件套至少返回一项，`expireAt` 是**支付超时时间**；
 * - `effectiveAt` / `endAt` 是本单产生的等级生效区间（`endAt` 为 null 表示长期）；
 * - `reused = true` 表示命中幂等键（`requestId` 命中 uk_member_level_order_request，重复提交），
 *   前端应提示「已存在开通单」而不是当成新单；
 * - **不回传 `requestId`**：它由前端生成并通过入参提交，回传没有意义，
 *   与 `SysOrderCreateRespSchema`（同样不含 requestId）口径一致。
 */
export const SysMemberLevelOpenRespSchema = z.object({
    orderId: z.string(),
    outTradeNo: z.string(),
    status: z.string(),
    levelId: z.string(),
    levelName: z.string().nullish(),
    payMode: SysMemberLevelOrderBaseSchema.shape.payMode,
    priceAmount: z.string(),
    payAmount: z.string(),
    /** 支付超时时间 YYYY-MM-DD HH:mm:ss（与 sys_member.expire_at 语义不同） */
    expireAt: z.string().nullish(),
    /** 等级实际生效时间；未生效（待支付）时为 null */
    effectiveAt: z.string().nullish(),
    /** 本单产生的等级到期时间；null = 长期/不设期限 */
    endAt: z.string().nullish(),
    qrImageUrl: z.string().nullish(),
    qrContent: z.string().nullish(),
    payUrl: z.string().nullish(),
    reused: z.boolean(),
})
export type SysMemberLevelOpenRespDTO = z.infer<typeof SysMemberLevelOpenRespSchema>

/**
 * 开通单状态查询 / 同步结果（自助轮询到账，或后台主动同步支付状态）。
 * `failReason` 仅在 `status` 为 `CL` / `FL` 时有值。
 */
export const SysMemberLevelOrderStatusRespSchema = z.object({
    outTradeNo: z.string(),
    status: z.string(),
    failReason: z.string().nullish(),
    /** 等级实际生效时间；未生效时为 null */
    effectiveAt: z.string().nullish(),
    /** 本单产生的等级到期时间；null = 长期/不设期限 */
    endAt: z.string().nullish(),
})
export type SysMemberLevelOrderStatusRespDTO = z.infer<typeof SysMemberLevelOrderStatusRespSchema>
