-- ============================================================================
-- Phase 4：可观测性页面菜单
--
-- 只新增「系统监控」页面与查询权限；不修改 init.sql / mysql-ddl.sql。
-- 执行：mysql -u <user> -p <database> < sql/migrations/2026-11-16-p4-monitor.sql
-- ============================================================================

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000510', '10000000-0000-0000-0000-000000000500',
       '系统监控', 'system:monitor:view', 1, '/system/monitor', 'system/monitor/index', 'i-lucide-activity', 620,
       0, 1, '系统监控页面', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:monitor:view' AND is_deleted = 0
);

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000511', '10000000-0000-0000-0000-000000000510',
       '系统监控查询', 'system:monitor:list', 2, NULL, NULL, NULL, 621,
       1, 1, '系统监控查询权限', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:monitor:list' AND is_deleted = 0
);
