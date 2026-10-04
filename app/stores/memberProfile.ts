import { defineStore } from 'pinia'

/**
 * 我的会员档案（等级名 / 等级价 / 到期时间 / 邀请码 / 下级数量）：**仅供展示**。
 *
 * 严禁拿它做权限或金额判断：
 * - 权限只认 `rbacProfile`（useRbacProfile），金额只认钱包 / 订单 / 流水接口；
 * - `levelName` / `levelPrice` 可能被后台随时改动（等级还会被停用），因此个人中心进入时、
 *   以及自助开通 / 续费成功后都必须 `refresh()`，否则会一直显示会话开始时那份过期缓存；
 * - 下级明细（`sysMember.myInvitees`）不在这里缓存，需要列出明文的页面自行请求。
 *
 * 缓存策略与 `stores/dict.ts` 保持一致：会话级缓存 + 并发合并（同一个请求只发一次）。
 */
export type MemberProfile = {
  member: { inviteCode?: string | null } | null
  levelName: string | null
  inviteeCount: number
  /** 当前等级 ID（仅用于展示「当前等级」标记，不得用于权限判断） */
  levelId: string | null
  /** 当前等级售价快照（元）；0 表示免费等级。仅供展示，金额一律以订单 / 钱包接口为准 */
  levelPrice: string | null
  /** 当前等级一次开通的有效天数；0 表示不设期限 */
  levelDurationDays: number
  /** 当前等级是否长期等级：true 表示永不过期、无需续费（服务端返回布尔值） */
  levelIsLongTerm: boolean
  /** 当前等级是否默认等级（服务端返回布尔值） */
  levelIsDefault: boolean
  /** 当前等级到期时间（YYYY-MM-DD HH:mm:ss）；null 表示永不过期（长期 / 默认等级） */
  expireAt: string | null
  /** 当前等级生效时间 */
  levelStartAt: string | null
  /** 等级来源：manual / open / renew / upgrade / default / auto_expire */
  levelSource: string | null
}

export const useMemberProfileStore = defineStore('memberProfile', () => {
  const profile = ref<MemberProfile | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  /** 进行中的请求：并发调用复用同一个 Promise，避免同页多组件各发一次 */
  let pending: Promise<MemberProfile | null> | null = null

  /**
   * 取档案：有缓存就直接返回，否则请求一次。
   * 请求失败不抛出，返回 null —— 调用方（个人中心 / 钱包页）据此走「不展示等级」的空态，
   * 保证档案拿不到时页面不白屏。
   */
  async function load(force = false): Promise<MemberProfile | null> {
    if (!force && profile.value) {
      return profile.value
    }

    const pendingRequest = pending
    if (!force && pendingRequest) {
      return await pendingRequest
    }

    const { $trpc } = useNuxtApp()

    loading.value = true
    error.value = null

    const request = (async () => {
      try {
        const result = await $trpc.sysMember.myProfile.query()

        const value: MemberProfile = {
          member: result.member ?? null,
          levelName: result.levelName ?? null,
          inviteeCount: result.inviteeCount ?? 0,
          levelId: result.levelId ?? null,
          levelPrice: result.levelPrice ?? null,
          levelDurationDays: result.levelDurationDays ?? 0,
          // 服务端契约里这两个字段是 0|1（输出 schema 声明为 number），
          // 但 Service 目前返回布尔值，这里用 Boolean() 两种形态都收敛成 boolean
          levelIsLongTerm: Boolean(result.levelIsLongTerm),
          levelIsDefault: Boolean(result.levelIsDefault),
          expireAt: result.expireAt ?? null,
          levelStartAt: result.levelStartAt ?? null,
          levelSource: result.levelSource ?? null
        }

        profile.value = value
        return value
      } catch (err) {
        error.value = err as Error
        return null
      }
    })()

    pending = request

    try {
      return await request
    } finally {
      pending = null
      loading.value = false
    }
  }

  /** 有缓存直接返回，没有则请求一次（钱包页等只读展示场景用） */
  async function ensure(): Promise<MemberProfile | null> {
    return await load()
  }

  /** 强制重取（等级可能已被后台改过，个人中心进入时用） */
  async function refresh(): Promise<MemberProfile | null> {
    return await load(true)
  }

  /** 登出 / 切换账号时清空缓存 */
  function clear() {
    profile.value = null
    error.value = null
    loading.value = false
    pending = null
  }

  return {
    profile,
    loading,
    error,
    ensure,
    refresh,
    clear
  }
})
