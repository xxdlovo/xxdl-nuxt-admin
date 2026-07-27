-- Nitro Tasks light job module.
-- Execute this after confirming the target database.

CREATE TABLE IF NOT EXISTS `sys_job` (
  `id` varchar(36) NOT NULL COMMENT '主键UUID',
  `job_name` varchar(100) NOT NULL COMMENT '任务名称',
  `job_code` varchar(100) NOT NULL COMMENT '任务编码，业务唯一',
  `handler_code` varchar(100) NOT NULL COMMENT '任务处理器编码，对应代码中的实现',
  `cron_expression` varchar(100) NOT NULL COMMENT 'Cron表达式',
  `cron_timezone` varchar(50) NOT NULL DEFAULT 'Asia/Shanghai' COMMENT 'Cron时区',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：0-停用，1-启用',
  `running_status` tinyint NOT NULL DEFAULT '0' COMMENT '运行状态：0-空闲，1-运行中',
  `last_run_at` timestamp NULL DEFAULT NULL COMMENT '上次执行时间',
  `next_run_at` timestamp NULL DEFAULT NULL COMMENT '下次执行时间',
  `last_success_at` timestamp NULL DEFAULT NULL COMMENT '上次成功时间',
  `last_fail_at` timestamp NULL DEFAULT NULL COMMENT '上次失败时间',
  `last_duration_ms` int DEFAULT NULL COMMENT '上次执行耗时毫秒',
  `last_error` text COMMENT '上次失败原因',
  `sort_order` int DEFAULT '0' COMMENT '排序',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除：0-否，1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_job_code` (`job_code`),
  KEY `idx_sys_job_dispatch` (`status`, `is_deleted`, `next_run_at`),
  KEY `idx_sys_job_handler` (`handler_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系统定时任务表';

CREATE TABLE IF NOT EXISTS `sys_job_log` (
  `id` varchar(36) NOT NULL COMMENT '主键UUID',
  `job_id` varchar(36) NOT NULL COMMENT '任务ID',
  `job_name` varchar(100) NOT NULL COMMENT '任务名称快照',
  `job_code` varchar(100) NOT NULL COMMENT '任务编码快照',
  `handler_code` varchar(100) NOT NULL COMMENT '任务处理器编码快照',
  `cron_expression` varchar(100) DEFAULT NULL COMMENT 'Cron表达式快照',
  `trigger_type` varchar(20) NOT NULL DEFAULT 'schedule' COMMENT '触发方式：schedule/manual',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '执行状态：0-运行中，1-成功，2-失败，3-跳过',
  `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
  `finished_at` timestamp NULL DEFAULT NULL COMMENT '结束时间',
  `duration_ms` int DEFAULT NULL COMMENT '执行耗时毫秒',
  `result` json DEFAULT NULL COMMENT '执行结果',
  `error_message` text COMMENT '错误信息',
  `error_stack` text COMMENT '错误堆栈',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除：0-否，1-是',
  PRIMARY KEY (`id`),
  KEY `idx_sys_job_log_job_time` (`job_id`, `started_at`),
  KEY `idx_sys_job_log_status_time` (`status`, `started_at`),
  KEY `idx_sys_job_log_code_time` (`job_code`, `started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系统定时任务执行日志表';

INSERT INTO `sys_menu`
  (`id`, `parent_id`, `name`, `code`, `type`, `path`, `component`, `icon`, `sort_order`, `visible`, `status`, `remark`, `created_by`, `created_at`, `updated_by`, `updated_at`, `is_deleted`)
VALUES
  ('10000000-0000-0000-0000-000000000231', '10000000-0000-0000-0000-000000000100', '任务管理', 'system:job', 1, '/system/job', 'system/job/index', 'i-lucide-timer', 231, 1, 1, '任务管理菜单', NULL, NOW(), NULL, NOW(), 0),
  ('10000000-0000-0000-0000-000000000232', '10000000-0000-0000-0000-000000000231', '任务查询', 'system:job:list', 2, NULL, NULL, NULL, 232, 0, 1, '任务查询权限', NULL, NOW(), NULL, NOW(), 0),
  ('10000000-0000-0000-0000-000000000233', '10000000-0000-0000-0000-000000000231', '任务新增', 'system:job:add', 2, NULL, NULL, NULL, 233, 0, 1, '任务新增权限', NULL, NOW(), NULL, NOW(), 0),
  ('10000000-0000-0000-0000-000000000234', '10000000-0000-0000-0000-000000000231', '任务编辑', 'system:job:edit', 2, NULL, NULL, NULL, 234, 0, 1, '任务编辑权限', NULL, NOW(), NULL, NOW(), 0),
  ('10000000-0000-0000-0000-000000000235', '10000000-0000-0000-0000-000000000231', '任务删除', 'system:job:del', 2, NULL, NULL, NULL, 235, 0, 1, '任务删除权限', NULL, NOW(), NULL, NOW(), 0),
  ('10000000-0000-0000-0000-000000000236', '10000000-0000-0000-0000-000000000231', '立即执行', 'system:job:run', 2, NULL, NULL, NULL, 236, 0, 1, '任务立即执行权限', NULL, NOW(), NULL, NOW(), 0),
  ('10000000-0000-0000-0000-000000000241', '10000000-0000-0000-0000-000000000210', '任务日志', 'system:jobLog', 1, '/system/job-log', 'system/job-log/index', 'i-lucide-file-clock', 241, 1, 1, '任务日志菜单', NULL, NOW(), NULL, NOW(), 0),
  ('10000000-0000-0000-0000-000000000242', '10000000-0000-0000-0000-000000000241', '任务日志查询', 'system:jobLog:list', 2, NULL, NULL, NULL, 242, 0, 1, '任务日志查询权限', NULL, NOW(), NULL, NOW(), 0),
  ('10000000-0000-0000-0000-000000000245', '10000000-0000-0000-0000-000000000241', '任务日志删除', 'system:jobLog:del', 2, NULL, NULL, NULL, 245, 0, 1, '任务日志删除权限', NULL, NOW(), NULL, NOW(), 0)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `code` = VALUES(`code`),
  `path` = VALUES(`path`),
  `component` = VALUES(`component`),
  `icon` = VALUES(`icon`),
  `sort_order` = VALUES(`sort_order`),
  `visible` = VALUES(`visible`),
  `status` = VALUES(`status`),
  `updated_at` = NOW(),
  `is_deleted` = 0;

INSERT INTO `sys_job`
  (`id`, `job_name`, `job_code`, `handler_code`, `cron_expression`, `cron_timezone`, `status`, `running_status`, `next_run_at`, `sort_order`, `remark`, `created_at`, `updated_at`, `is_deleted`)
VALUES
  ('90000000-0000-0000-0000-000000000001', '清理系统日志', 'clean-system-log', 'system:clean-log', '0 2 * * *', 'Asia/Shanghai', 0, 0, NULL, 1, '每天凌晨2点清理30天前日志，默认停用', NOW(), NOW(), 0),
  ('90000000-0000-0000-0000-000000000002', '重置演示数据', 'reset-demo-data', 'system:reset-demo-data', '0 3 * * *', 'Asia/Shanghai', 0, 0, NULL, 2, '预留任务，默认停用', NOW(), NOW(), 0)
ON DUPLICATE KEY UPDATE
  `job_name` = VALUES(`job_name`),
  `handler_code` = VALUES(`handler_code`),
  `cron_expression` = VALUES(`cron_expression`),
  `cron_timezone` = VALUES(`cron_timezone`),
  `sort_order` = VALUES(`sort_order`),
  `remark` = VALUES(`remark`),
  `updated_at` = NOW(),
  `is_deleted` = 0;
