import { mysqlTable, primaryKey, varchar, tinyint, timestamp, unique, index, text } from "drizzle-orm/mysql-core"

export const sysOauthAccount = mysqlTable("sys_oauth_account", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	provider: varchar({ length: 20 }).notNull(),
	providerUserId: varchar("provider_user_id", { length: 64 }).notNull(),
	providerLogin: varchar("provider_login", { length: 100 }),
	avatar: varchar({ length: 255 }),
	rawProfile: text("raw_profile"),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	index("idx_oauth_user").on(table.userId),
	primaryKey({ columns: [table.id], name: "sys_oauth_account_id"}),
	unique("uk_oauth_provider_user").on(table.provider, table.providerUserId),
]);
