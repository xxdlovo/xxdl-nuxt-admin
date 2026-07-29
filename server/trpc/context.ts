import type { H3Event } from 'h3'
import { useDb } from '#server/drizzle/db'

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

  return {
    db: useDb(),
    event,
    session,
    user: session.user ?? null,
    currentPermissionCode: null as string | null,
    permissionCodes: null as string[] | null,
    dataPermission: null as DataPermission | null
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
