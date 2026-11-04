import { mysqlTable, primaryKey, unique, index, varchar, tinyint, timestamp, decimal } from "drizzle-orm/mysql-core"

export const sysMemberCouponUse = mysqlTable("sys_member_coupon_use", {
	id: varchar({ length: 36 }).notNull(),
	couponId: varchar("coupon_id", { length: 36 }).notNull(),
	couponCode: varchar("coupon_code", { length: 32 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	scene: varchar({ length: 20 }).notNull(),
	bizNo: varchar("biz_no", { length: 64 }).notNull(),
	discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).default('0.00').notNull(),
	giftAmount: decimal("gift_amount", { precision: 12, scale: 2 }).default('0.00').notNull(),
	status: varchar({ length: 20 }).default('locked').notNull(),
	usedAt: timestamp("used_at", { mode: 'string' }),
	releasedAt: timestamp("released_at", { mode: 'string' }),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	index("idx_member_coupon_use_user").on(table.userId, table.status),
	primaryKey({ columns: [table.id], name: "sys_member_coupon_use_id" }),
	unique("uk_member_coupon_use").on(table.couponId, table.bizNo),
]);
