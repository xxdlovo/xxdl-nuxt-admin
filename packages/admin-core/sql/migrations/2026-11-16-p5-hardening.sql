-- ============================================================================
-- Phase 5：工程收尾字段
--
-- 只新增本次需要的列，不修改 init.sql / mysql-ddl.sql，不写旧数据。
-- 执行：mysql -u <user> -p <database> < sql/migrations/2026-11-16-p5-hardening.sql
-- ============================================================================

SET @db_name = DATABASE();

-- sys_job.misfire_policy
SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `sys_job` ADD COLUMN `misfire_policy` TINYINT NOT NULL DEFAULT 1 COMMENT ''错过执行策略：1立即执行，2执行一次，3放弃执行'' AFTER `cron_timezone`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'sys_job' AND COLUMN_NAME = 'misfire_policy'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- sys_job.concurrent
SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `sys_job` ADD COLUMN `concurrent` TINYINT NOT NULL DEFAULT 1 COMMENT ''是否允许并发：1允许，0禁止'' AFTER `misfire_policy`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'sys_job' AND COLUMN_NAME = 'concurrent'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- sys_menu.external_link
SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `sys_menu` ADD COLUMN `external_link` VARCHAR(500) DEFAULT NULL COMMENT ''外链地址；设置后优先于 path'' AFTER `component`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'sys_menu' AND COLUMN_NAME = 'external_link'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- sys_menu.query
SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `sys_menu` ADD COLUMN `query` VARCHAR(500) DEFAULT NULL COMMENT ''路由查询参数，不带问号'' AFTER `external_link`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'sys_menu' AND COLUMN_NAME = 'query'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
