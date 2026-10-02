/**
 * 会员页面共用的行类型。
 *
 * 与 `sysMember.page` / `getById` 的返回保持一致：
 * 会员档案字段 + 联表带来的用户、等级与钱包字段。
 */
export type MemberProfileRow = {
  id?: string | null
  userId?: string | null
  levelId?: string | null
  levelName?: string | null
  inviteCode?: string | null
  inviterId?: string | null
  invitedAt?: string | null
  levelChangedAt?: string | null
  levelRemark?: string | null
  status?: number | null
  remark?: string | null
  createdAt?: string | null
  nickname?: string | null
  username?: string | null
  phone?: string | null
  email?: string | null
  rechargeBalance?: string | null
  giftBalance?: string | null
  frozenRecharge?: string | null
  frozenGift?: string | null
  totalRecharge?: string | null
  totalGift?: string | null
  totalConsume?: string | null
}
