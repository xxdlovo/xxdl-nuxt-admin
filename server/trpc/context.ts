import type { H3Event } from 'h3'
import { useDb } from '#server/drizzle/db'

export type AuthUser = {
  id: string
  username: string
  nickname?: string | null
  avatar?: string | null
  isAdmin?: number | null
}

export async function createContext(event: H3Event) {
  const session = await getUserSession(event)

  return {
    db: useDb(),
    event,
    session,
    user: session.user ?? null,
    permissionCodes: null as string[] | null
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
