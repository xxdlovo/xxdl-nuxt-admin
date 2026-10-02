import { mysqlTable, primaryKey, unique, index, varchar, tinyint, timestamp } from "drizzle-orm/mysql-core"

export const sysMember = mysqlTable("sys_member", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	levelId: varchar("level_id", { length: 36 }),
	levelChangedAt: timestamp("level_changed_at", { mode: 'string' }),
	levelRemark: varchar("level_remark", { length: 255 }),
	inviteCode: varchar("invite_code", { length: 20 }).notNull(),
	inviterId: varchar("inviter_id", { length: 36 }),
	inviteCodeId: varchar("invite_code_id", { length: 36 }),
	invitedAt: timestamp("invited_at", { mode: 'string' }),
	status: tinyint().default(1),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	index("idx_member_inviter").on(table.inviterId),
	index("idx_member_level").on(table.levelId),
	primaryKey({ columns: [table.id], name: "sys_member_id" }),
	unique("uk_member_invite_code").on(table.inviteCode),
	unique("uk_member_user").on(table.userId),
]);
