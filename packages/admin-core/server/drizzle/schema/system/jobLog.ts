import { index, int, json, mysqlTable, primaryKey, text, timestamp, tinyint, varchar } from "drizzle-orm/mysql-core"

export const sysJobLog = mysqlTable("sys_job_log", {
  id: varchar({ length: 36 }).notNull(),
  jobId: varchar("job_id", { length: 36 }).notNull(),
  jobName: varchar("job_name", { length: 100 }).notNull(),
  jobCode: varchar("job_code", { length: 100 }).notNull(),
  handlerCode: varchar("handler_code", { length: 100 }).notNull(),
  cronExpression: varchar("cron_expression", { length: 100 }),
  triggerType: varchar("trigger_type", { length: 20 }).default("schedule").notNull(),
  status: tinyint().default(0).notNull(),
  startedAt: timestamp("started_at", { mode: "string" }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { mode: "string" }),
  durationMs: int("duration_ms"),
  result: json().$type<unknown>(),
  errorMessage: text("error_message"),
  errorStack: text("error_stack"),
  createdBy: varchar("created_by", { length: 36 }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updatedBy: varchar("updated_by", { length: 36 }),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().onUpdateNow().notNull(),
  isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
  primaryKey({ columns: [table.id], name: "sys_job_log_id" }),
  index("idx_sys_job_log_job_time").on(table.jobId, table.startedAt),
  index("idx_sys_job_log_status_time").on(table.status, table.startedAt),
  index("idx_sys_job_log_code_time").on(table.jobCode, table.startedAt),
])
