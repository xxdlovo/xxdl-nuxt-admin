import type { H3Event } from 'h3'
import { useDb } from '#admin/server/drizzle/db'
import { getSessionState } from '#admin/server/utils/sessionGuard'

export type AuthUser = {
  id: string
  username: string
  email?: string | null
  nickname?: string | null
  avatar?: string | null
  phone?: string | null
  gender?: number | null
  deptId?: string | null
  isAdmin?: number | null
}

export type DataPermission = {
  loaded: boolean
  isAll: boolean
  hasDataScope: boolean
  deptIds: string[]
  customDeptIds: string[]
  includeSelf: boolean
}

export async function createContext(event: H3Event) {
  const session = await getUserSession(event)
  const sessionUser = session.user ?? null

  // 被强退/过期的会话：Cookie 仍然存在，但不再当作登录态。
  // 没有 sessionId 的旧会话保持兼容，直接视为有效。
  const sessionState = sessionUser
    ? await getSessionState(session.sessionId)
    : null
  const user = sessionUser && sessionState?.active
    ? sessionUser
    : null

  return {
    db: useDb(),
    event,
    session,
    sessionState,
    user,
    currentPermissionCode: null as string | null,
    permissionCodes: null as string[] | null,
    dataPermission: null as DataPermission | null,
    // 由 proc({ dataScope: false }) 标记，buildScope 据此跳过数据范围条件
    skipDataScope: false
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
