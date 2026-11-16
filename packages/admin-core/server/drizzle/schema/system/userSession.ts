import { index, mysqlTable, primaryKey, timestamp, varchar } from "drizzle-orm/mysql-core"

/**
 * 在线会话表。
 *
 * nuxt-auth-utils 的 session 是签名 Cookie，服务端默认无状态；
 * 这张表只记录“哪些会话仍然有效”，用于在线用户列表与强制下线。
 * `id` 会写进 session 的 `sessionId` 字段，鉴权时按 id 回查。
 */
export const sysUserSession = mysqlTable("sys_user_session", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	username: varchar({ length: 50 }).notNull(),
	ip: varchar({ length: 50 }),
	userAgent: varchar("user_agent", { length: 500 }),
	browser: varchar({ length: 50 }),
	os: varchar({ length: 50 }),
	loginAt: timestamp("login_at", { mode: "string" }).defaultNow().notNull(),
	lastSeenAt: timestamp("last_seen_at", { mode: "string" }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { mode: "string" }),
	revokedAt: timestamp("revoked_at", { mode: "string" }),
	revokedBy: varchar("revoked_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "sys_user_session_id" }),
	index("idx_user_session_user").on(table.userId),
	index("idx_user_session_revoked").on(table.revokedAt),
	index("idx_user_session_last_seen").on(table.lastSeenAt),
]);
