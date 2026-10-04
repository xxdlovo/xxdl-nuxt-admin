import {
  SysMemberLevelOrderQuerySchema,
  type SysMemberLevelOrderQueryDTO,
  type SysMemberLevelOrderRespDTO
} from '#shared/system/memberLevelOrder'

/**
 * 会员开通单列表行：直接复用 shared 的响应 DTO（单据本体 + 联表展示字段
 * nickname / username / phone），不自造字段，等后台契约扩展时类型自动跟着变。
 */
export type MemberLevelOrderRow = SysMemberLevelOrderRespDTO

/** 后台列表查询条件：直接复用 shared 的 Query 契约（outTradeNo 模糊 + 等值 + 创建时间区间） */
export type MemberLevelOrderQuery = SysMemberLevelOrderQueryDTO

/** 搜索表单校验：用本模块的 QuerySchema，避免前端再写一份规则 */
export const memberLevelOrderQuerySchema = SysMemberLevelOrderQuerySchema

/**
 * 详情弹窗可能带出的「关联支付单」展示字段。
 *
 * 与充值单详情（`sys-member-recharge-detail.vue` 的 `linkedPay*`）同一命名习惯：
 * 关联不到时为 null；**shared 的输出 schema 还没定义这些字段**，因此这里按可选字段声明，
 * 后端返回了就展示、没返回就显示 `-`，不会因为契约未落地而阻断页面。
 */
export type MemberLevelOrderLinkedPay = {
  linkedPayOutTradeNo?: string | null
  linkedPayStatus?: string | null
  linkedPayChannelCode?: string | null
  linkedPayMode?: string | null
  linkedPayAmount?: string | number | null
  linkedPayCurrency?: string | null
  linkedPayProviderStatus?: string | null
  linkedPayProviderOrderId?: string | null
  linkedPayTransactionId?: string | null
  linkedPayPaidAt?: string | null
  linkedPayExpireAt?: string | null
  linkedPayFailReason?: string | null
  linkedPayCreatedAt?: string | null
}

export type MemberLevelOrderDetail = MemberLevelOrderRow & MemberLevelOrderLinkedPay

/**
 * 支付方式 → 文案 key。
 *
 * balance / online 与订单模块同义，直接复用 `module.system.order.payMode.*`；
 * `free` / `manual` 是开通单特有，服务端才会写入（用户不可选），因此各新增一条文案：
 * - `free`   —— 0 元免费等级开通；
 * - `manual` —— 后台「会员管理」手工调整等级 / 期限补的留痕单（不动钱，所以文案里不带「支付」字样）。
 * 列表页、详情弹窗与搜索下拉都读这一份映射，新增取值不需要改页面。
 */
export const memberLevelOrderPayModeRecord: Record<string, string> = {
  balance: 'module.system.order.payMode.balance',
  online: 'module.system.order.payMode.online',
  free: 'module.system.memberLevelOrder.payMode.free',
  manual: 'module.system.memberLevelOrder.payMode.manual'
}
