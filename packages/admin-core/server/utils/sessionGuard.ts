import { eq, lt, or, sql } from 'drizzle-orm'
import { useDb } from '#admin/server/drizzle/db'
import { sysUserSession } from '#admin/server/drizzle/schema'

/**
 * 会话有效性守卫。
 *
 * session Cookie 是签名且无状态的，默认无法“踢人”；
 * 这里把 sessionId 回查到 sys_user_session：
 * - 记录被撤销（revoked_at 非空）或过期 → 会话无效；
 * - 返回原因（revoked / expired），让上层能区分“被管理员踢出”和“自然过期”；
 * - 本地缓存 10 秒，避免每个 tRPC 请求都打一次库，同时让“踢人”最多延迟 10 秒生效；
 * - 有效会话按 60 秒节流更新 last_seen_at，供在线列表展示。
 */

const ACTIVE_CACHE_TTL_MS = 10 * 1000
const TOUCH_INTERVAL_MS = 60 * 1000

export type SessionStateReason = 'active' | 'revoked' | 'expired' | 'invalid' | 'unknown'

export type SessionState = {
    active: boolean
    reason: SessionStateReason
}

type CacheEntry = {
    state: SessionState
    checkedAt: number
}

const stateCache = new Map<string, CacheEntry>()
const lastTouchAt = new Map<string, number>()

function isExpired(value?: string | null) {
    if (!value) {
        return false
    }

    const time = new Date(value).getTime()
    return Number.isFinite(time) && time <= Date.now()
}

/**
 * 解析会话状态。
 *
 * 没有 sessionId 的旧会话直接视为有效：升级后用户重新登录一次即可获得 sessionId，
 * 不应该因为新增字段把所有在线用户强制踢下线。
 */
export async function getSessionState(sessionId?: string | null): Promise<SessionState> {
    if (!sessionId) {
        return { active: true, reason: 'active' }
    }

    const now = Date.now()
    const cached = stateCache.get(sessionId)
    if (cached && now - cached.checkedAt < ACTIVE_CACHE_TTL_MS) {
        return cached.state
    }

    const db = useDb()
    let state: SessionState

    try {
        const rows = await db
            .select({
                revokedAt: sysUserSession.revokedAt,
                expiresAt: sysUserSession.expiresAt,
            })
            .from(sysUserSession)
            .where(eq(sysUserSession.id, sessionId))
            .limit(1)

        const row = rows[0]

        if (!row) {
            state = { active: false, reason: 'invalid' }
        }
        else if (row.revokedAt) {
            state = { active: false, reason: 'revoked' }
        }
        else if (isExpired(row.expiresAt)) {
            state = { active: false, reason: 'expired' }
        }
        else {
            state = { active: true, reason: 'active' }
        }
    }
    catch (error) {
        // 迁移脚本尚未执行时不应把整个后台锁死：先按旧会话放行，并打印明确错误。
        console.error('[Session] check failed, allow legacy session', error)
        return { active: true, reason: 'unknown' }
    }

    stateCache.set(sessionId, { state, checkedAt: now })

    if (state.active) {
        void touchSession(sessionId)
    }

    return state
}

/** 兼容旧调用：只关心是否有效。 */
export async function isSessionActive(sessionId?: string | null) {
    return (await getSessionState(sessionId)).active
}

/** 节流更新最后活跃时间；失败不影响请求。 */
export async function touchSession(sessionId: string) {
    const now = Date.now()
    const previous = lastTouchAt.get(sessionId) ?? 0
    if (now - previous < TOUCH_INTERVAL_MS) {
        return
    }

    lastTouchAt.set(sessionId, now)

    try {
        const db = useDb()
        await db
            .update(sysUserSession)
            .set({ lastSeenAt: sql`CURRENT_TIMESTAMP` })
            .where(eq(sysUserSession.id, sessionId))
    }
    catch (error) {
        // 最后活跃时间只影响展示，写失败不应该阻断业务请求
        console.error('[Session] touch failed', error)
    }
}

/** 撤销后立即清本地缓存，让当前实例的后续请求马上生效。 */
export function invalidateSessionCache(sessionId?: string | null) {
    if (!sessionId) {
        return
    }

    stateCache.delete(sessionId)
    lastTouchAt.delete(sessionId)
}

/** 清理 7 天前的过期/已撤销会话，避免表无限增长。 */
export async function cleanupExpiredSessions() {
    const db = useDb()

    try {
        await db
            .delete(sysUserSession)
            .where(or(
                lt(sysUserSession.expiresAt, sql`DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 7 DAY)`),
                lt(sysUserSession.revokedAt, sql`DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 7 DAY)`)
            ))
    }
    catch (error) {
        console.error('[Session] cleanup failed', error)
    }
}
