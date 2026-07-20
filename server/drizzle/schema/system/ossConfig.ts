import { mysqlTable, primaryKey, varchar, tinyint, timestamp } from "drizzle-orm/mysql-core"

export const sysOssConfig = mysqlTable("sys_oss_config", {
	id: varchar({ length: 36 }).notNull(),
	configKey: varchar("config_key", { length: 100 }).notNull(),
	configName: varchar("config_name", { length: 100 }).notNull(),
	service: varchar({ length: 50 }).notNull(),
	endpoint: varchar({ length: 255 }),
	region: varchar({ length: 100 }),
	bucketName: varchar("bucket_name", { length: 100 }),
	accessKey: varchar("access_key", { length: 255 }),
	secretKey: varchar("secret_key", { length: 500 }),
	domain: varchar({ length: 255 }),
	prefix: varchar({ length: 255 }),
	isHttps: tinyint("is_https").default(1),
	accessPolicy: tinyint("access_policy").default(1),
	isDefault: tinyint("is_default").default(0),
	status: tinyint().default(1),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	primaryKey({ columns: [table.id], name: "sys_oss_config_id"}),
]);
