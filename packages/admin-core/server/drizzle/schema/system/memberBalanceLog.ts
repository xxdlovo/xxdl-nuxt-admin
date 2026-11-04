import { mysqlTable, primaryKey, unique, index, varchar, tinyint, timestamp, decimal } from "drizzle-orm/mysql-core"

export const sysMemberBalanceLog = mysqlTable("sys_member_balance_log", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	account: varchar({ length: 20 }).notNull(),
	direction: varchar({ length: 10 }).notNull(),
	amount: decimal({ precision: 12, scale: 2 }).notNull(),
	balanceBefore: decimal("balance_before", { precision: 12, scale: 2 }).notNull(),
	balanceAfter: decimal("balance_after", { precision: 12, scale: 2 }).notNull(),
	bizType: varchar("biz_type", { length: 30 }).notNull(),
	bizNo: varchar("biz_no", { length: 64 }).notNull(),
	dedupKey: varchar("dedup_key", { length: 128 }).notNull(),
	operatorId: varchar("operator_id", { length: 36 }),
	reason: varchar({ length: 255 }),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	index("idx_member_log_account").on(table.account, table.createdAt),
	index("idx_member_log_biz").on(table.bizType, table.bizNo),
	index("idx_member_log_user").on(table.userId, table.createdAt),
	primaryKey({ columns: [table.id], name: "sys_member_balance_log_id" }),
	unique("uk_member_log_dedup").on(table.dedupKey),
]);
