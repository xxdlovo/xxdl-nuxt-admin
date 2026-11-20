import { mysqlTable, primaryKey, unique, index, varchar, tinyint, int, timestamp } from "drizzle-orm/mysql-core"

/**
 * 会员等级 × 功能值矩阵。
 *
 * 一个 `(level_id, feature_key)` 只有一行；**等级未配置的键没有行**，
 * 读取时回落到 `sys_member_feature.default_value`（见 `server/utils/entitlementSource.ts`）。
 *
 * `value` 的合法取值随 `sys_member_feature.kind`：
 * - `switch`：0 / 1；
 * - `quota`：-1（不限）或 >= 0（额度）。
 * 列上不加 CHECK，由 Service 在写入口校验。
 *
 * 表结构见 sql/mysql-ddl-member-entitlement.sql（Part 1.2），列名与列注释逐列对应。
 */
export const sysMemberLevelFeature = mysqlTable("sys_member_level_feature", {
	id: varchar({ length: 36 }).notNull(),
	levelId: varchar("level_id", { length: 36 }).notNull(),
	featureKey: varchar("feature_key", { length: 64 }).notNull(),
	value: int().default(0).notNull(),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	index("idx_member_level_feature_key").on(table.featureKey),
	primaryKey({ columns: [table.id], name: "sys_member_level_feature_id" }),
	unique("uk_member_level_feature").on(table.levelId, table.featureKey),
]);
