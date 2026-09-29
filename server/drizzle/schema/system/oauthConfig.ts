import { mysqlTable, primaryKey, unique, index, varchar, tinyint, int, timestamp, json } from "drizzle-orm/mysql-core"

export const sysOauthConfig = mysqlTable("sys_oauth_config", {
	id: varchar({ length: 36 }).notNull(),
	platform: varchar({ length: 20 }).notNull(),
	platformName: varchar("platform_name", { length: 50 }).notNull(),
	icon: varchar({ length: 255 }),
	clientId: varchar("client_id", { length: 128 }),
	clientSecret: varchar("client_secret", { length: 500 }),
	redirectUrl: varchar("redirect_url", { length: 500 }),
	scope: varchar({ length: 255 }),
	defaultRoleId: varchar("default_role_id", { length: 36 }),
	status: tinyint().default(1),
	sortOrder: int("sort_order").default(0),
	extra: json(),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	unique("uk_oauth_config_platform").on(table.platform),
	index("idx_oauth_config_status_sort").on(table.status, table.sortOrder),
	index("idx_oauth_config_role").on(table.defaultRoleId),
	primaryKey({ columns: [table.id], name: "sys_oauth_config_id"}),
]);
