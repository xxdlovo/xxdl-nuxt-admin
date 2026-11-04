import { mysqlTable, primaryKey, unique, index, varchar, tinyint, timestamp, decimal } from "drizzle-orm/mysql-core"

export const sysMemberGiftGrant = mysqlTable("sys_member_gift_grant", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	amount: decimal({ precision: 12, scale: 2 }).notNull(),
	remainAmount: decimal("remain_amount", { precision: 12, scale: 2 }).notNull(),
	source: varchar({ length: 30 }).notNull(),
	expireAt: timestamp("expire_at", { mode: 'string' }),
	bizNo: varchar("biz_no", { length: 64 }).notNull(),
	status: varchar({ length: 20 }).default('active').notNull(),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	index("idx_member_gift_user").on(table.userId, table.status, table.expireAt),
	primaryKey({ columns: [table.id], name: "sys_member_gift_grant_id" }),
	unique("uk_member_gift_biz").on(table.bizNo),
]);
