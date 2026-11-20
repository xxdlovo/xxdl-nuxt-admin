import { mysqlTable, primaryKey, unique, index, varchar, tinyint, int, timestamp } from "drizzle-orm/mysql-core"

/**
 * 会员功能目录（等级能力开关 / 配额）。
 *
 * 一个 `feature_key` = 一个受控能力；取值类型 `kind`：
 * - `switch`：开关，0 关 / 1 开；
 * - `quota`：配额，-1 表示不限，>= 0 表示额度。
 *
 * 等级未配置该功能时取 `default_value`（见 `server/utils/entitlementSource.ts`）。
 * `admin_bypass=1` 表示管理员（sys_user.is_admin=1）取到「开关=1 / 配额=不限」；
 * `user_show=0` 表示仅后端强制，不向端用户展示名称 / 额度 / 具体上限。
 *
 * 表结构见 sql/mysql-ddl-member-entitlement.sql（Part 1.1），列名与列注释逐列对应。
 */
export const sysMemberFeature = mysqlTable("sys_member_feature", {
	id: varchar({ length: 36 }).notNull(),
	featureKey: varchar("feature_key", { length: 64 }).notNull(),
	name: varchar({ length: 50 }).notNull(),
	kind: varchar({ length: 10 }).default('switch').notNull(),
	unit: varchar({ length: 20 }),
	groupName: varchar("group_name", { length: 50 }),
	sortOrder: int("sort_order").default(0).notNull(),
	defaultValue: int("default_value").default(1).notNull(),
	resolverKey: varchar("resolver_key", { length: 64 }),
	adminBypass: tinyint("admin_bypass").default(1).notNull(),
	userShow: tinyint("user_show").default(1).notNull(),
	status: tinyint().default(1).notNull(),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	index("idx_member_feature_group").on(table.groupName, table.sortOrder, table.isDeleted),
	primaryKey({ columns: [table.id], name: "sys_member_feature_id" }),
	unique("uk_member_feature_key").on(table.featureKey),
]);
