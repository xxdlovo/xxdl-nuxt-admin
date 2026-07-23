import { mysqlTable, primaryKey, varchar, tinyint, int, timestamp, text, index } from "drizzle-orm/mysql-core"

export const sysNotice = mysqlTable("sys_notice", {
	id: varchar({ length: 36 }).notNull(),
	title: varchar({ length: 200 }).notNull(),
	summary: varchar({ length: 500 }),
	content: text(),
	contentFormat: varchar("content_format", { length: 20 }).default("html").notNull(),
	noticeType: tinyint("notice_type").default(1).notNull(),
	topFlag: tinyint("top_flag").default(0).notNull(),
	publishStatus: tinyint("publish_status").default(1).notNull(),
	publishTime: timestamp("publish_time", { mode: "string" }),
	sortOrder: int("sort_order").default(0),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	primaryKey({ columns: [table.id], name: "sys_notice_id" }),
	index("idx_sys_notice_status_time").on(table.publishStatus, table.publishTime),
	index("idx_sys_notice_top_sort").on(table.topFlag, table.sortOrder),
]);
