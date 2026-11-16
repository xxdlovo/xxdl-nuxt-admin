-- ============================================================================
-- Phase 3：代码生成器元数据表与菜单
--
-- 适用：已执行 P0/P2 迁移的数据库。
-- 执行：mysql -u <user> -p <database> < sql/migrations/2026-11-16-p3-codegen.sql
--
-- 说明：
--   1. 只新增本功能需要的表与菜单，不修改 init.sql / mysql-ddl.sql；
--   2. 不预置任何生成配置数据，表由界面“导入表”触发；
--   3. 建表 IF NOT EXISTS，菜单 WHERE NOT EXISTS，可重复执行。
-- ============================================================================

CREATE TABLE IF NOT EXISTS `sys_gen_table` (
  `id` varchar(36) NOT NULL COMMENT '主键UUID',
  `table_name` varchar(100) NOT NULL COMMENT '数据库表名',
  `table_comment` varchar(255) DEFAULT NULL COMMENT '表注释',
  `module_name` varchar(100) NOT NULL COMMENT '模块名，如 system/product',
  `business_name` varchar(100) NOT NULL COMMENT '业务名，如 SysProduct',
  `author` varchar(100) DEFAULT NULL COMMENT '作者',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除：0-否，1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_gen_table_name` (`table_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='代码生成表配置';

CREATE TABLE IF NOT EXISTS `sys_gen_table_column` (
  `id` varchar(36) NOT NULL COMMENT '主键UUID',
  `table_id` varchar(36) NOT NULL COMMENT '生成表配置ID',
  `column_name` varchar(100) NOT NULL COMMENT '数据库列名',
  `column_comment` varchar(255) DEFAULT NULL COMMENT '列注释',
  `column_type` varchar(100) DEFAULT NULL COMMENT '数据库类型',
  `ts_type` varchar(50) DEFAULT NULL COMMENT 'TypeScript 类型',
  `property_name` varchar(100) DEFAULT NULL COMMENT 'TS 属性名',
  `is_pk` tinyint DEFAULT '0' COMMENT '是否主键',
  `is_required` tinyint DEFAULT '0' COMMENT '是否必填',
  `is_insert` tinyint DEFAULT '1' COMMENT '是否出现在新增表单',
  `is_edit` tinyint DEFAULT '1' COMMENT '是否出现在编辑表单',
  `is_list` tinyint DEFAULT '1' COMMENT '是否出现在列表',
  `is_query` tinyint DEFAULT '0' COMMENT '是否作为查询条件',
  `query_type` varchar(10) DEFAULT 'eq' COMMENT '查询方式：eq/like',
  `dict_code` varchar(100) DEFAULT NULL COMMENT '字典编码',
  `html_type` varchar(20) DEFAULT 'input' COMMENT '表单控件：input/textarea/select/number/date/password/switch',
  `sort_order` int DEFAULT '0' COMMENT '排序',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除：0-否，1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_gen_column` (`table_id`, `column_name`),
  KEY `idx_gen_column_table` (`table_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='代码生成列配置';

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000600', NULL, '系统工具', 'system:tool', 0, NULL, NULL, 'i-lucide-wrench', 70, 0, 1, '系统工具目录', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:tool' AND is_deleted = 0
);

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000601', '10000000-0000-0000-0000-000000000600', '代码生成', 'system:gen', 1, '/system/gen', 'system/gen/index', 'i-lucide-wand-sparkles', 701, 0, 1, '代码生成菜单', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:gen' AND is_deleted = 0
);

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000602', '10000000-0000-0000-0000-000000000601', '生成列表查询', 'system:gen:list', 2, NULL, NULL, NULL, 702, 1, 1, '代码生成查询权限', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:gen:list' AND is_deleted = 0
);

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000603', '10000000-0000-0000-0000-000000000601', '导入表', 'system:gen:import', 2, NULL, NULL, NULL, 703, 1, 1, '导入数据库表权限', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:gen:import' AND is_deleted = 0
);

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000604', '10000000-0000-0000-0000-000000000601', '编辑生成配置', 'system:gen:edit', 2, NULL, NULL, NULL, 704, 1, 1, '编辑生成配置权限', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:gen:edit' AND is_deleted = 0
);

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000605', '10000000-0000-0000-0000-000000000601', '预览代码', 'system:gen:preview', 2, NULL, NULL, NULL, 705, 1, 1, '预览生成代码权限', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:gen:preview' AND is_deleted = 0
);

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000606', '10000000-0000-0000-0000-000000000601', '下载代码', 'system:gen:download', 2, NULL, NULL, NULL, 706, 1, 1, '下载生成代码权限', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:gen:download' AND is_deleted = 0
);

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000607', '10000000-0000-0000-0000-000000000601', '删除生成配置', 'system:gen:del', 2, NULL, NULL, NULL, 707, 1, 1, '删除生成配置权限', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:gen:del' AND is_deleted = 0
);
