-- ============================================================================
-- Phase 2：岗位 / 自定义数据权限 / 角色分配用户
--
-- 适用：已经执行过 P0 迁移的数据库。
-- 执行：mysql -u <user> -p <database> < sql/migrations/2026-11-16-p2-org-excel.sql
--
-- 说明：
--   1. 本脚本只包含本次新增的表与菜单，不修改 init.sql / mysql-ddl.sql；
--   2. 不写旧数据回填：已有用户默认没有岗位，已有角色保持原数据范围；
--   3. 建表使用 IF NOT EXISTS，菜单/配置使用 WHERE NOT EXISTS，可重复执行。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. sys_post：岗位
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `sys_post` (
  `id` varchar(36) NOT NULL COMMENT '主键UUID',
  `code` varchar(50) NOT NULL COMMENT '岗位编码',
  `name` varchar(50) NOT NULL COMMENT '岗位名称',
  `sort_order` int DEFAULT '0' COMMENT '排序',
  `status` tinyint DEFAULT '1' COMMENT '状态：0-停用，1-正常',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除：0-否，1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_post_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='岗位信息表';

-- ---------------------------------------------------------------------------
-- 2. sys_user_post：用户-岗位
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `sys_user_post` (
  `id` varchar(36) NOT NULL COMMENT '主键UUID',
  `user_id` varchar(36) NOT NULL COMMENT '用户ID',
  `post_id` varchar(36) NOT NULL COMMENT '岗位ID',
  `status` tinyint DEFAULT '1' COMMENT '状态：0-停用，1-正常',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除：0-否，1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_post` (`user_id`, `post_id`),
  KEY `idx_user_post_post` (`post_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户岗位关联表';

-- ---------------------------------------------------------------------------
-- 3. sys_role_dept：角色-自定义数据权限部门
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `sys_role_dept` (
  `id` varchar(36) NOT NULL COMMENT '主键UUID',
  `role_id` varchar(36) NOT NULL COMMENT '角色ID',
  `dept_id` varchar(36) NOT NULL COMMENT '部门ID',
  `status` tinyint DEFAULT '1' COMMENT '状态：0-停用，1-正常',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除：0-否，1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_dept` (`role_id`, `dept_id`),
  KEY `idx_role_dept_dept` (`dept_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色自定义数据权限部门表';

-- ---------------------------------------------------------------------------
-- 4. 菜单与权限
-- ---------------------------------------------------------------------------

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000141', '10000000-0000-0000-0000-000000000100',
       '岗位管理', 'system:post', 1, '/system/post', 'system/post/index', 'i-lucide-briefcase-business', 141,
       0, 1, '岗位管理菜单', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:post' AND is_deleted = 0
);

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000142', '10000000-0000-0000-0000-000000000141',
       '岗位查询', 'system:post:list', 2, NULL, NULL, NULL, 142,
       1, 1, '岗位查询权限', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:post:list' AND is_deleted = 0
);

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000143', '10000000-0000-0000-0000-000000000141',
       '岗位新增', 'system:post:add', 2, NULL, NULL, NULL, 143,
       1, 1, '岗位新增权限', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:post:add' AND is_deleted = 0
);

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000144', '10000000-0000-0000-0000-000000000141',
       '岗位编辑', 'system:post:edit', 2, NULL, NULL, NULL, 144,
       1, 1, '岗位编辑权限', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:post:edit' AND is_deleted = 0
);

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000145', '10000000-0000-0000-0000-000000000141',
       '岗位删除', 'system:post:del', 2, NULL, NULL, NULL, 145,
       1, 1, '岗位删除权限', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:post:del' AND is_deleted = 0
);

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
SELECT '10000000-0000-0000-0000-000000000116', '10000000-0000-0000-0000-000000000111',
       '分配用户', 'system:role:assign', 2, NULL, NULL, NULL, 116,
       1, 1, '角色分配用户权限', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM sys_menu WHERE code = 'system:role:assign' AND is_deleted = 0
);
