import { mysqlTable, primaryKey, timestamp, tinyint, varchar } from 'drizzle-orm/mysql-core'

export const sysConfig = mysqlTable('sys_config', {
  id: varchar({ length: 36 }).notNull(),
  configName: varchar('config_name', { length: 36 }),
  configKey: varchar('config_key', { length: 255 }).notNull(),
  configValue: varchar('config_value', { length: 255 }).notNull(),
  configType: tinyint('config_type').default(1),
  status: tinyint().default(1),
  remark: varchar({ length: 255 }),
  createdBy: varchar('created_by', { length: 36 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedBy: varchar('updated_by', { length: 36 }),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
  isDeleted: tinyint('is_deleted').default(0)
}, (table) => [
  primaryKey({ columns: [table.id], name: 'sys_config_id' })
])
