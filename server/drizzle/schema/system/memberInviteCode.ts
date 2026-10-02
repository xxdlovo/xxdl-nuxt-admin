import { mysqlTable, primaryKey, unique, index, varchar, tinyint, int, timestamp } from "drizzle-orm/mysql-core"

export const sysMemberInviteCode = mysqlTable("sys_member_invite_code", {
	id: varchar({ length: 36 }).notNull(),
	code: varchar({ length: 20 }).notNull(),
	ownerUserId: varchar("owner_user_id", { length: 36 }),
	source: varchar({ length: 30 }).default('system').notNull(),
	maxUse: int("max_use").default(0).notNull(),
	usedCount: int("used_count").default(0).notNull(),
	expireAt: timestamp("expire_at", { mode: 'string' }),
	status: tinyint().default(1),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	index("idx_member_invite_owner").on(table.ownerUserId),
	index("idx_member_invite_status").on(table.status, table.isDeleted),
	primaryKey({ columns: [table.id], name: "sys_member_invite_code_id" }),
	unique("uk_member_invite_code_code").on(table.code),
]);
