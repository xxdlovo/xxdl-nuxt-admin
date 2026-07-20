import { mysqlTable, primaryKey, varchar, tinyint, timestamp, bigint } from "drizzle-orm/mysql-core"

export const sysOss = mysqlTable("sys_oss", {
	id: varchar({ length: 36 }).notNull(),
	configId: varchar("config_id", { length: 36 }),
	fileName: varchar("file_name", { length: 255 }).notNull(),
	originalName: varchar("original_name", { length: 255 }).notNull(),
	fileSuffix: varchar("file_suffix", { length: 50 }),
	fileSize: bigint("file_size", { mode: "number" }),
	contentType: varchar("content_type", { length: 100 }),
	bucketName: varchar("bucket_name", { length: 100 }),
	objectName: varchar("object_name", { length: 500 }).notNull(),
	url: varchar({ length: 1000 }).notNull(),
	md5: varchar({ length: 64 }),
	etag: varchar({ length: 255 }),
	service: varchar({ length: 50 }).notNull(),
	uploadUserId: varchar("upload_user_id", { length: 36 }),
	status: tinyint().default(1),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	primaryKey({ columns: [table.id], name: "sys_oss_id"}),
]);
