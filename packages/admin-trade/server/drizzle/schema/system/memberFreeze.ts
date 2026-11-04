import { mysqlTable, primaryKey, unique, index, varchar, tinyint, timestamp, decimal } from "drizzle-orm/mysql-core"

export const sysMemberFreeze = mysqlTable("sys_member_freeze", {
	id: varchar({ length: 36 }).notNull(),
	bizNo: varchar("biz_no", { length: 64 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	amount: decimal({ precision: 12, scale: 2 }).notNull(),
	giftAmount: decimal("gift_amount", { precision: 12, scale: 2 }).default('0.00').notNull(),
	rechargeAmount: decimal("recharge_amount", { precision: 12, scale: 2 }).default('0.00').notNull(),
	status: varchar({ length: 20 }).default('FROZEN').notNull(),
	subject: varchar({ length: 200 }),
	attach: varchar({ length: 255 }),
	expireAt: timestamp("expire_at", { mode: 'string' }),
	confirmedAt: timestamp("confirmed_at", { mode: 'string' }),
	releasedAt: timestamp("released_at", { mode: 'string' }),
	releaseReason: varchar("release_reason", { length: 255 }),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	index("idx_member_freeze_expire").on(table.status, table.expireAt),
	index("idx_member_freeze_user").on(table.userId, table.status),
	primaryKey({ columns: [table.id], name: "sys_member_freeze_id" }),
	unique("uk_member_freeze_biz").on(table.bizNo),
]);
