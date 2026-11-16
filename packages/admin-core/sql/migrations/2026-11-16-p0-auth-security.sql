-- ============================================================================
-- P0：认证安全 + 在线会话
--
-- 适用：已经执行过 sql/mysql-ddl.sql + sql/init.sql 的数据库。
-- 执行：mysql -u <user> -p <database> < sql/migrations/2026-11-16-p0-auth-security.sql
--
-- 说明：
--   1. ADD COLUMN 用 information_schema + 动态 SQL 做存在性判断，脚本可重复执行；
--   2. 配置与菜单用 WHERE NOT EXISTS 去重；
--   3. 新建表使用 CREATE TABLE IF NOT EXISTS。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. sys_user：登录失败计数与锁定截止时间
-- ---------------------------------------------------------------------------

SET @db_name = DATABASE();

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `sys_user` ADD COLUMN `login_fail_count` INT NOT NULL DEFAULT 0 COMMENT ''连续登录失败次数'' AFTER `last_login_ip`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'sys_user'
    AND COLUMN_NAME = 'login_fail_count'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `sys_user` ADD COLUMN `locked_until` DATETIME NULL DEFAULT NULL COMMENT ''锁定截止时间'' AFTER `login_fail_count`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'sys_user'
    AND COLUMN_NAME = 'locked_until'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 2. sys_user_session：在线会话
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `sys_user_session` (
  `id` varchar(36) NOT NULL COMMENT '会话ID（写入 nuxt-auth-utils session）',
  `user_id` varchar(36) NOT NULL COMMENT '用户ID',
  `username` varchar(50) NOT NULL COMMENT '登录账号',
  `ip` varchar(50) DEFAULT NULL COMMENT '登录IP',
  `user_agent` varchar(500) DEFAULT NULL COMMENT 'User-Agent',
  `browser` varchar(50) DEFAULT NULL COMMENT '浏览器',
  `os` varchar(50) DEFAULT NULL COMMENT '操作系统',
  `login_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
  `last_seen_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后活跃时间',
  `expires_at` timestamp NULL DEFAULT NULL COMMENT '过期时间',
  `revoked_at` timestamp NULL DEFAULT NULL COMMENT '撤销时间',
  `revoked_by` varchar(36) DEFAULT NULL COMMENT '撤销人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_session_user` (`user_id`),
  KEY `idx_user_session_revoked` (`revoked_at`),
  KEY `idx_user_session_last_seen` (`last_seen_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户在线会话表';

-- ---------------------------------------------------------------------------
-- 3. 系统参数：验证码开关、失败次数、锁定时长
-- ---------------------------------------------------------------------------

INSERT INTO sys_config
  (id, config_name, config_key, config_value, config_type, status, remark, created_by, created_at, updated_by, updated_at, is_deleted)
SELECT '09171960-f26f-4457-8cae-aeeb2ff45286', '是否开启登录验证码', 'system_captcha_enabled', 'true', 1, 1, '登录页图形验证码开关', NULL, NOW(), NULL, NOW(), 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_config WHERE config_key = 'system_captcha_enabled' AND is_deleted = 0
);

INSERT INTO sys_config
  (id, config_name, config_key, config_value, config_type, status, remark, created_by, created_at, updated_by, updated_at, is_deleted)
SELECT '09171961-f26f-4457-8cae-aeeb2ff45286', '登录失败锁定次数', 'system_login_max_retry', '5', 1, 1, '连续密码错误达到该次数后锁定账号', NULL, NOW(), NULL, NOW(), 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_config WHERE config_key = 'system_login_max_retry' AND is_deleted = 0
);

INSERT INTO sys_config
  (id, config_name, config_key, config_value, config_type, status, remark, created_by, created_at, updated_by, updated_at, is_deleted)
SELECT '09171962-f26f-4457-8cae-aeeb2ff45286', '账号锁定时长（分钟）', 'system_login_lock_minutes', '10', 1, 1, '登录失败锁定后的解锁等待分钟数', NULL, NOW(), NULL, NOW(), 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_config WHERE config_key = 'system_login_lock_minutes' AND is_deleted = 0
);

-- ---------------------------------------------------------------------------
-- 4. 菜单：系统监控 / 在线用户 / 权限按钮 / 用户解锁
-- ---------------------------------------------------------------------------

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000500', NULL, '系统监控', 'system:monitor', 0, NULL, NULL, 'i-lucide-activity', 60, 0, 1, '系统监控目录', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:monitor' AND is_deleted = 0
);

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000501', '10000000-0000-0000-0000-000000000500', '在线用户', 'system:online', 1, '/system/online', 'system/online/index', 'i-lucide-radio', 601, 0, 1, '在线用户菜单', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:online' AND is_deleted = 0
);

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000502', '10000000-0000-0000-0000-000000000501', '在线用户查询', 'system:online:list', 2, NULL, NULL, NULL, 602, 1, 1, '在线用户查询权限', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:online:list' AND is_deleted = 0
);

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000503', '10000000-0000-0000-0000-000000000501', '强制下线', 'system:online:forceLogout', 2, NULL, NULL, NULL, 603, 1, 1, '在线用户强制下线权限', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:online:forceLogout' AND is_deleted = 0
);

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000106', '10000000-0000-0000-0000-000000000101', '用户解锁', 'system:user:unlock', 2, NULL, NULL, NULL, 106, 1, 1, '用户解锁权限', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:user:unlock' AND is_deleted = 0
);
