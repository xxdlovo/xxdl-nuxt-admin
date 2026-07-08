import { mysqlTable,primaryKey, varchar, tinyint, timestamp } from "drizzle-orm/mysql-core"

export const demo = mysqlTable("demo", {
	id: varchar({ length: 36 }).notNull(),
	status: tinyint().default(1),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
	field1: varchar({ length: 100 }),
	field2: varchar({ length: 100 }),
},
(table) => [
	primaryKey({ columns: [table.id], name: "demo_id"}),
]);