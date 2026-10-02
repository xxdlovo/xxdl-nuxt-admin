import { mysqlTable, primaryKey, unique, index, varchar, tinyint, int, timestamp, decimal } from "drizzle-orm/mysql-core"

export const sysMemberWallet = mysqlTable("sys_member_wallet", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	currency: varchar({ length: 10 }).default('CNY').notNull(),
	rechargeBalance: decimal("recharge_balance", { precision: 12, scale: 2 }).default('0.00').notNull(),
	giftBalance: decimal("gift_balance", { precision: 12, scale: 2 }).default('0.00').notNull(),
	frozenRecharge: decimal("frozen_recharge", { precision: 12, scale: 2 }).default('0.00').notNull(),
	frozenGift: decimal("frozen_gift", { precision: 12, scale: 2 }).default('0.00').notNull(),
	totalRecharge: decimal("total_recharge", { precision: 12, scale: 2 }).default('0.00').notNull(),
	totalGift: decimal("total_gift", { precision: 12, scale: 2 }).default('0.00').notNull(),
	totalConsume: decimal("total_consume", { precision: 12, scale: 2 }).default('0.00').notNull(),
	version: int().default(0).notNull(),
	status: tinyint().default(1),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	index("idx_member_wallet_status").on(table.status, table.isDeleted),
	primaryKey({ columns: [table.id], name: "sys_member_wallet_id" }),
	unique("uk_member_wallet_user").on(table.userId),
]);
