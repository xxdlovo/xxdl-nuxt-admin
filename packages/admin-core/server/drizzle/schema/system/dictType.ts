import { mysqlTable, primaryKey, unique, varchar, tinyint, timestamp } from "drizzle-orm/mysql-core"

export const sysDictType = mysqlTable("sys_dict_type", {
	id: varchar({ length: 36 }).notNull(),
	name: varchar({ length: 50 }).notNull(),
	code: varchar({ length: 50 }).notNull(),
	status: tinyint().default(1),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	primaryKey({ columns: [table.id], name: "sys_dict_type_id"}),
	unique("uk_dict_code").on(table.code),
]);
