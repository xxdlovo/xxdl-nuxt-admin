import { index, mysqlTable, primaryKey, tinyint, timestamp, unique, varchar } from "drizzle-orm/mysql-core"

export const sysUserPost = mysqlTable("sys_user_post", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	postId: varchar("post_id", { length: 36 }).notNull(),
	status: tinyint().default(1),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	primaryKey({ columns: [table.id], name: "sys_user_post_id" }),
	unique("uk_user_post").on(table.userId, table.postId),
	index("idx_user_post_post").on(table.postId),
])
