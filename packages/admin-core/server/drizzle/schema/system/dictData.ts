import { mysqlTable, primaryKey, varchar, int, tinyint, timestamp } from "drizzle-orm/mysql-core"

export const sysDictData = mysqlTable("sys_dict_data", {
	id: varchar({ length: 36 }).notNull(),
	typeId: varchar("type_id", { length: 36 }).notNull(),
	label: varchar({ length: 50 }).notNull(),
	i18nKey: varchar("i18n_key", { length: 150 }),
	listClass: varchar("list_class", { length: 30 }),
	value: varchar({ length: 100 }).notNull(),
	sortOrder: int("sort_order").default(0),
	status: tinyint().default(1),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	primaryKey({ columns: [table.id], name: "sys_dict_data_id"}),
]);
