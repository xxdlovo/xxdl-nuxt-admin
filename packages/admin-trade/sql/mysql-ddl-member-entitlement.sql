-- ============================================================================
-- 会员等级「功能开关与配额」（entitlement）数据层 + 后台菜单权限
--
-- 目标库：与 .env 的 DB_DATABASE 一致；MySQL 8.0.19+（菜单 upsert 别名语法）
-- 前置条件：会员模块既有表已就位（sys_member_level / sys_member 来自
--   doc/main/mysql-ddl-member-balance.sql），目录 id ...1000 与会员等级页 ...1001
--   由该脚本建立；本脚本只**引用**它们，不改动。
-- 执行方式：整段执行（Navicat / mysql 客户端均可；脚本含动态 SQL，需支持多语句执行）
-- 执行顺序：Part 1 建表 → Part 2 菜单与权限 → Part 3 示例功能种子（默认不执行）
--           → Part 4 执行结果自检
-- 配套脚本：本脚本**已包含**菜单与权限，不需要再执行其它菜单脚本。
--
-- 幂等性：**整段可重复执行，不会报错、不会产生重复行**，做法与
--   doc/main/mysql-ddl-member-level-price.sql / mysql-menu-member-level-order.sql 一致：
--   1. 建表：CREATE TABLE IF NOT EXISTS；
--   2. 补列 / 补索引：MySQL 8.0 的 ALTER TABLE ... ADD COLUMN 没有 IF NOT EXISTS，
--      故用 information_schema.COLUMNS / STATISTICS 计数做守卫 + PREPARE/EXECUTE 动态 SQL，
--      已存在时改执行一条无害的 SELECT，不中断脚本、也不会重复加列加键；
--   3. 菜单行：INSERT ... AS new ON DUPLICATE KEY UPDATE（命中 id 主键时只覆盖展示字段）；
--   4. 角色授权：sys_role_menu 只有主键、没有 (role_id, menu_id) 唯一键，
--      故先 DELETE 这批关联再 INSERT（与本目录既有脚本同一套路）。
--
--   **若你已执行过本脚本的早期版本**（例如 sys_member_feature 还没有 user_show 列）：
--   直接**重跑本脚本**即可对齐 —— 1.1.2 的守卫会补齐缺列 / 缺索引，
--   建表与菜单段都会走 skip 或只覆盖展示字段，不会动任何既有数据。
--
-- 表设计要点：
--   1. `sys_member_feature` 是**功能目录**（一个 feature_key = 一个受控能力），
--      `sys_member_level_feature` 是**等级 × 功能值**矩阵；两级合并后的取值由
--      `server/utils/entitlementSource.ts` 统一解析（目录 → 矩阵 → 默认值 → 管理员绕过）；
--   2. `kind` 只有 switch（开关）/ quota（配额）两种，取值语义完全不同，
--      故「switch 只允许 0/1、quota 允许 -1 或 >= 0」由 Service 校验，列上不加 CHECK；
--   3. `-1` 是**不限**（与 shared/system/entitlement 的 UNLIMITED 一致），
--      不是「负数扣减」，读取方必须先判 isUnlimited 再判剩余量；
--   4. `resolver_key` 指向 `registerEntitlementResolver` 注册过的计量器；
--      kind=quota 时必填且必须已注册（否则「填了配额没人能计量」），
--      kind=switch 时必须为空（Service 校验，列上不加约束）；
--      **与 feature_key 解耦**：基座守卫用 `meta.resolverKey ?? feature_key` 查计量器，
--      因此多个功能可以共用一个计量器（如 student.max / student.export 都按 studentCount 统计），
--      后台保存时只校验「该键已注册」，不要求等于 feature_key；
--   5. `user_show=0` 表示「仅后端强制」：能力照常生效，但不向端用户展示
--      名称 / 额度 / 具体上限（entitlementSource 会把它放进 hiddenFeatures）。
--
-- id 段说明（会员模块页面固定在 10000000-0000-0000-0000-0000000010xx）：
--   ...1000 目录 / ...1001~1005 会员等级 / ...1011~1018 会员管理 / ...1021~1026 优惠码 /
--   ...1031~1036 充值记录 / ...1041~1045 消费冻结单 / ...1051~1056 余额流水 /
--   ...1061~1065 会员开通记录（...20xx 是 sys_job 任务段，不要用）。
--   本脚本占用 ...1071~1075（功能与配额页面 + 4 个按钮）与 ...1006
--   （会员等级页下的「等级能力矩阵」按钮），已逐段核对空闲。
-- 目录内 sort_order：兄弟页面已用 1~7（会员等级 / 会员管理 / 优惠码 / 充值记录 /
--   消费冻结单 / 余额流水 / 会员开通记录），本页取 8 排在末位（Part 4 自检会打印）。
-- ============================================================================


-- ============================================================================
-- Part 1：建表（2 张）
--   1.1 sys_member_feature        功能目录
--   1.2 sys_member_level_feature  等级 × 功能值矩阵
-- 说明：1.1.2 / 1.2.2 是「补列 / 补索引」守卫，全新执行时全部走 skip；
--      只有早期版本建过缺列的表时才真正执行 ALTER。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1.1 功能目录
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sys_member_feature` (
  `id` varchar(36) NOT NULL COMMENT '主键',
  `feature_key` varchar(64) NOT NULL COMMENT '功能键（全局唯一，创建后不可修改；如 class.max / report.export）',
  `name` varchar(50) NOT NULL COMMENT '功能名称（后台展示用；user_show=0 时不向端用户展示）',
  `kind` varchar(10) NOT NULL DEFAULT 'switch' COMMENT '取值类型: switch-开关, quota-配额',
  `unit` varchar(20) DEFAULT NULL COMMENT '配额单位（如 个 / 次 / MB；switch 可空）',
  `group_name` varchar(50) DEFAULT NULL COMMENT '功能分组（后台按组折叠展示）',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '显示排序（同组内升序）',
  `default_value` int NOT NULL DEFAULT '1' COMMENT '等级未配置时的取值：switch 用 0/1；quota 用 >=0 的额度或 -1 表示不限',
  `resolver_key` varchar(64) DEFAULT NULL COMMENT '配额计量器键：kind=quota 必填且须已注册（多个功能可共用一个计量器，如 studentCount）；kind=switch 必须为空；未填时守卫回退用 feature_key',
  `admin_bypass` tinyint NOT NULL DEFAULT '1' COMMENT '管理员是否绕过: 1-是（开关置 1 / 配额置不限）, 0-否',
  `user_show` tinyint NOT NULL DEFAULT '1' COMMENT '是否向端用户展示: 1-是, 0-否（0 = 仅后端强制，用户侧不显示名称/额度/具体上限）',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态: 0-禁用, 1-启用',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_member_feature_key` (`feature_key`),
  KEY `idx_member_feature_group` (`group_name`, `sort_order`, `is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员功能目录（等级能力开关/配额）';

-- 1.1.2 补列守卫：逐列检查，缺哪列补哪列（全新执行时 16 条全走 skip）
SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_feature` ADD COLUMN `feature_key` varchar(64) NOT NULL COMMENT ''功能键（全局唯一，创建后不可修改；如 class.max / report.export）''',
  'SELECT ''skip: sys_member_feature.feature_key''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_feature' AND COLUMN_NAME = 'feature_key');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_feature` ADD COLUMN `name` varchar(50) NOT NULL COMMENT ''功能名称（后台展示用；user_show=0 时不向端用户展示）''',
  'SELECT ''skip: sys_member_feature.name''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_feature' AND COLUMN_NAME = 'name');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_feature` ADD COLUMN `kind` varchar(10) NOT NULL DEFAULT ''switch'' COMMENT ''取值类型: switch-开关, quota-配额''',
  'SELECT ''skip: sys_member_feature.kind''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_feature' AND COLUMN_NAME = 'kind');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_feature` ADD COLUMN `unit` varchar(20) DEFAULT NULL COMMENT ''配额单位（如 个 / 次 / MB；switch 可空）''',
  'SELECT ''skip: sys_member_feature.unit''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_feature' AND COLUMN_NAME = 'unit');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_feature` ADD COLUMN `group_name` varchar(50) DEFAULT NULL COMMENT ''功能分组（后台按组折叠展示）''',
  'SELECT ''skip: sys_member_feature.group_name''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_feature' AND COLUMN_NAME = 'group_name');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_feature` ADD COLUMN `sort_order` int NOT NULL DEFAULT 0 COMMENT ''显示排序（同组内升序）''',
  'SELECT ''skip: sys_member_feature.sort_order''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_feature' AND COLUMN_NAME = 'sort_order');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_feature` ADD COLUMN `default_value` int NOT NULL DEFAULT 1 COMMENT ''等级未配置时的取值：switch 用 0/1；quota 用 >=0 的额度或 -1 表示不限''',
  'SELECT ''skip: sys_member_feature.default_value''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_feature' AND COLUMN_NAME = 'default_value');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_feature` ADD COLUMN `resolver_key` varchar(64) DEFAULT NULL COMMENT ''配额计量器键：kind=quota 必填且须已注册（多个功能可共用一个计量器，如 studentCount）；kind=switch 必须为空；未填时守卫回退用 feature_key''',
  'SELECT ''skip: sys_member_feature.resolver_key''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_feature' AND COLUMN_NAME = 'resolver_key');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_feature` ADD COLUMN `admin_bypass` tinyint NOT NULL DEFAULT 1 COMMENT ''管理员是否绕过: 1-是（开关置 1 / 配额置不限）, 0-否''',
  'SELECT ''skip: sys_member_feature.admin_bypass''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_feature' AND COLUMN_NAME = 'admin_bypass');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_feature` ADD COLUMN `user_show` tinyint NOT NULL DEFAULT 1 COMMENT ''是否向端用户展示: 1-是, 0-否（0 = 仅后端强制，用户侧不显示名称/额度/具体上限）''',
  'SELECT ''skip: sys_member_feature.user_show''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_feature' AND COLUMN_NAME = 'user_show');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_feature` ADD COLUMN `status` tinyint NOT NULL DEFAULT 1 COMMENT ''状态: 0-禁用, 1-启用''',
  'SELECT ''skip: sys_member_feature.status''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_feature' AND COLUMN_NAME = 'status');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_feature` ADD COLUMN `created_by` varchar(36) DEFAULT NULL COMMENT ''创建人ID''',
  'SELECT ''skip: sys_member_feature.created_by''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_feature' AND COLUMN_NAME = 'created_by');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_feature` ADD COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT ''记录时间''',
  'SELECT ''skip: sys_member_feature.created_at''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_feature' AND COLUMN_NAME = 'created_at');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_feature` ADD COLUMN `updated_by` varchar(36) DEFAULT NULL COMMENT ''更新人ID''',
  'SELECT ''skip: sys_member_feature.updated_by''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_feature' AND COLUMN_NAME = 'updated_by');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_feature` ADD COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT ''更新时间''',
  'SELECT ''skip: sys_member_feature.updated_at''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_feature' AND COLUMN_NAME = 'updated_at');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_feature` ADD COLUMN `is_deleted` tinyint DEFAULT 0 COMMENT ''是否删除: 0-否, 1-是''',
  'SELECT ''skip: sys_member_feature.is_deleted''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_feature' AND COLUMN_NAME = 'is_deleted');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.1.3 补唯一键 / 索引守卫（早期版本建表时可能缺；info_schema.STATISTICS 按 INDEX_NAME 查）
SET @ddl := (SELECT IF(COUNT(DISTINCT INDEX_NAME) = 0,
  'ALTER TABLE `sys_member_feature` ADD UNIQUE KEY `uk_member_feature_key` (`feature_key`)',
  'SELECT ''skip: uk_member_feature_key''') FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_feature' AND INDEX_NAME = 'uk_member_feature_key');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(DISTINCT INDEX_NAME) = 0,
  'ALTER TABLE `sys_member_feature` ADD KEY `idx_member_feature_group` (`group_name`, `sort_order`, `is_deleted`)',
  'SELECT ''skip: idx_member_feature_group''') FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_feature' AND INDEX_NAME = 'idx_member_feature_group');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ---------------------------------------------------------------------------
-- 1.2 等级 × 功能值矩阵
--   一个 (level_id, feature_key) 只有一行；等级未配置的键**没有行**，读取时走目录 default_value
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sys_member_level_feature` (
  `id` varchar(36) NOT NULL COMMENT '主键',
  `level_id` varchar(36) NOT NULL COMMENT '会员等级ID(sys_member_level.id)',
  `feature_key` varchar(64) NOT NULL COMMENT '功能键(sys_member_feature.feature_key)',
  `value` int NOT NULL DEFAULT '0' COMMENT '该等级下的取值：switch 用 0/1；quota 用 -1(不限) 或 >=0 的额度',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_member_level_feature` (`level_id`, `feature_key`),
  KEY `idx_member_level_feature_key` (`feature_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员等级功能值矩阵（等级 × 功能）';

-- 1.2.2 补列守卫（全新执行时全部走 skip）
SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_level_feature` ADD COLUMN `level_id` varchar(36) NOT NULL COMMENT ''会员等级ID(sys_member_level.id)''',
  'SELECT ''skip: sys_member_level_feature.level_id''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level_feature' AND COLUMN_NAME = 'level_id');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_level_feature` ADD COLUMN `feature_key` varchar(64) NOT NULL COMMENT ''功能键(sys_member_feature.feature_key)''',
  'SELECT ''skip: sys_member_level_feature.feature_key''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level_feature' AND COLUMN_NAME = 'feature_key');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_level_feature` ADD COLUMN `value` int NOT NULL DEFAULT 0 COMMENT ''该等级下的取值：switch 用 0/1；quota 用 -1(不限) 或 >=0 的额度''',
  'SELECT ''skip: sys_member_level_feature.value''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level_feature' AND COLUMN_NAME = 'value');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_level_feature` ADD COLUMN `created_by` varchar(36) DEFAULT NULL COMMENT ''创建人ID''',
  'SELECT ''skip: sys_member_level_feature.created_by''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level_feature' AND COLUMN_NAME = 'created_by');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_level_feature` ADD COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT ''记录时间''',
  'SELECT ''skip: sys_member_level_feature.created_at''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level_feature' AND COLUMN_NAME = 'created_at');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_level_feature` ADD COLUMN `updated_by` varchar(36) DEFAULT NULL COMMENT ''更新人ID''',
  'SELECT ''skip: sys_member_level_feature.updated_by''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level_feature' AND COLUMN_NAME = 'updated_by');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_level_feature` ADD COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT ''更新时间''',
  'SELECT ''skip: sys_member_level_feature.updated_at''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level_feature' AND COLUMN_NAME = 'updated_at');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `sys_member_level_feature` ADD COLUMN `is_deleted` tinyint DEFAULT 0 COMMENT ''是否删除: 0-否, 1-是''',
  'SELECT ''skip: sys_member_level_feature.is_deleted''') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level_feature' AND COLUMN_NAME = 'is_deleted');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.2.3 补唯一键 / 索引守卫
SET @ddl := (SELECT IF(COUNT(DISTINCT INDEX_NAME) = 0,
  'ALTER TABLE `sys_member_level_feature` ADD UNIQUE KEY `uk_member_level_feature` (`level_id`, `feature_key`)',
  'SELECT ''skip: uk_member_level_feature''') FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level_feature' AND INDEX_NAME = 'uk_member_level_feature');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(DISTINCT INDEX_NAME) = 0,
  'ALTER TABLE `sys_member_level_feature` ADD KEY `idx_member_level_feature_key` (`feature_key`)',
  'SELECT ''skip: idx_member_level_feature_key''') FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level_feature' AND INDEX_NAME = 'idx_member_level_feature_key');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ============================================================================
-- Part 2：菜单与权限（1 页面 + 4 按钮 + 1 个等级页按钮 = 6 行）
--
-- 权限码与后端路由一一对应（server/trade-router/modules/...）：
--   system:memberFeature           功能与配额页面（列表页）
--   system:memberFeature:list      查询目录 / 已注册计量键
--   system:memberFeature:add       新增功能
--   system:memberFeature:edit      编辑功能
--   system:memberFeature:del       删除 / 批量删除功能
--   system:memberLevel:feature     保存某个等级的「能力矩阵」（挂在会员等级页 ...1001 下，
--                                  与等级新增/编辑分开授权：能改等级不等于能改能力配额）
--
-- 图标 i-lucide-toy-brick（积木 = 能力拼装），与本目录既有图标不重复。
-- ============================================================================

INSERT INTO `sys_menu`
  (`id`, `parent_id`, `name`, `code`, `type`, `path`, `component`, `icon`, `sort_order`, `visible`, `status`, `remark`, `created_by`, `updated_by`, `is_deleted`)
VALUES
  -- 页面
  ('10000000-0000-0000-0000-000000001071', '10000000-0000-0000-0000-000000001000', '功能与配额', 'system:memberFeature', 1, '/system/member-feature', 'system/member-feature/index', 'i-lucide-toy-brick', 8, 0, 1, '会员等级能力开关与配额目录', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),

  -- 页面按钮权限
  ('10000000-0000-0000-0000-000000001072', '10000000-0000-0000-0000-000000001071', '功能查询', 'system:memberFeature:list', 2, NULL, NULL, NULL, 1, 1, 1, '目录分页 / 已注册计量键列表', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001073', '10000000-0000-0000-0000-000000001071', '功能新增', 'system:memberFeature:add', 2, NULL, NULL, NULL, 2, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001074', '10000000-0000-0000-0000-000000001071', '功能编辑', 'system:memberFeature:edit', 2, NULL, NULL, NULL, 3, 1, 1, 'feature_key 创建后不可修改', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001075', '10000000-0000-0000-0000-000000001071', '功能删除', 'system:memberFeature:del', 2, NULL, NULL, NULL, 4, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),

  -- 等级能力矩阵保存（挂在会员等级页 ...1001 下；...1006 为该页下一个空闲 id）
  ('10000000-0000-0000-0000-000000001006', '10000000-0000-0000-0000-000000001001', '等级能力矩阵', 'system:memberLevel:feature', 2, NULL, NULL, NULL, 5, 1, 1, '保存某个等级的功能开关与配额（整体覆盖）', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0)
AS new
ON DUPLICATE KEY UPDATE
  `parent_id` = new.parent_id,
  `name` = new.name,
  `code` = new.code,
  `type` = new.type,
  `path` = new.path,
  `component` = new.component,
  `icon` = new.icon,
  `sort_order` = new.sort_order,
  `visible` = new.visible,
  `status` = new.status,
  `remark` = new.remark,
  `updated_by` = new.updated_by,
  `is_deleted` = new.is_deleted;


-- ---------------------------------------------------------------------------
-- Part 2.2 角色授权
--
-- - 管理员账号（sys_user.is_admin = 1）走「全量菜单」分支，不需要任何授权；
-- - 其它角色只有在 sys_role_menu 里有记录才会看到对应菜单与权限；
-- - sys_role_menu 只有主键、没有 (role_id, menu_id) 唯一键，所以幂等做法是
--   「先删掉这批 (角色 × 菜单) 关联，再统一插入」。
--
-- 授权矩阵：
--   部门经理 dept_manager：页面 + list + add + edit + del + memberLevel:feature
--   业务运营 operator    ：同上
--   审计员   auditor     ：页面 + list（只读，不给保存矩阵）
--   访客     guest       ：不授
-- ---------------------------------------------------------------------------

-- 2.2.1 清掉本脚本负责的这批关联（可重复执行的关键）
DELETE FROM `sys_role_menu`
WHERE `menu_id` IN (
  '10000000-0000-0000-0000-000000001071',
  '10000000-0000-0000-0000-000000001072',
  '10000000-0000-0000-0000-000000001073',
  '10000000-0000-0000-0000-000000001074',
  '10000000-0000-0000-0000-000000001075',
  '10000000-0000-0000-0000-000000001006'
)
AND `role_id` IN (
  '20000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000004'
);

-- 2.2.2 部门经理 / 业务运营：页面 + 查询 + 新增 + 编辑 + 删除 + 等级能力矩阵
INSERT INTO `sys_role_menu`
  (`id`, `role_id`, `menu_id`, `status`, `remark`, `created_by`, `updated_by`, `is_deleted`)
SELECT UUID(), r.`id`, m.`id`, 1, '会员功能与配额菜单授权',
       '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0
FROM `sys_role` r
JOIN `sys_menu` m ON m.`id` IN (
  '10000000-0000-0000-0000-000000001071',
  '10000000-0000-0000-0000-000000001072',
  '10000000-0000-0000-0000-000000001073',
  '10000000-0000-0000-0000-000000001074',
  '10000000-0000-0000-0000-000000001075',
  '10000000-0000-0000-0000-000000001006'
)
WHERE r.`id` IN (
  '20000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000003'
)
AND r.`is_deleted` = 0;

-- 2.2.3 审计员：页面 + 查询（只读，不给增删改与保存矩阵）
INSERT INTO `sys_role_menu`
  (`id`, `role_id`, `menu_id`, `status`, `remark`, `created_by`, `updated_by`, `is_deleted`)
SELECT UUID(), r.`id`, m.`id`, 1, '会员功能与配额菜单授权',
       '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0
FROM `sys_role` r
JOIN `sys_menu` m ON m.`id` IN (
  '10000000-0000-0000-0000-000000001071',
  '10000000-0000-0000-0000-000000001072'
)
WHERE r.`id` = '20000000-0000-0000-0000-000000000004'
AND r.`is_deleted` = 0;


-- ============================================================================
-- Part 3：示例功能种子（**默认不执行**，供 P3 演示用）
--
-- 打开方式：把下面整段注释块去掉后单独执行（不要与 Part 1/2 混跑，避免演示数据
-- 进入生产）。示例功能覆盖 quota / switch 两种形态，并演示「多个功能共用同一个计量器」：
--   class.max     quota  班级数量上限      计量器 classCount
--   student.max   quota  学员数量上限      计量器 studentCount
--   student.export quota 学员导出条数上限  计量器 studentCount  ← 与 student.max 共用
--   lock.max      quota  并发锁定数        计量器 lockCount
--   report.export switch 是否允许导出报表  （无计量器；后端强制，不向端用户展示名称）
--
-- 注意：resolver_key 必须是后端 `registerEntitlementResolver` 注册过的**计量器键**，
--   **不要求等于 feature_key**（student.max / student.export 共用 studentCount 就是典型用法）。
--   若某个键尚未注册，后台表单保存时会报「计量器未注册」，这是预期行为。
-- ============================================================================

/*
INSERT INTO `sys_member_feature`
  (`id`, `feature_key`, `name`, `kind`, `unit`, `group_name`, `sort_order`, `default_value`, `resolver_key`, `admin_bypass`, `user_show`, `status`, `created_by`, `updated_by`, `is_deleted`)
VALUES
  (UUID(), 'class.max',      '班级数量上限',   'quota',  '个', '教学能力', 1, 1,  'classCount',   1, 1, 1, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  (UUID(), 'student.max',    '学员数量上限',   'quota',  '人', '教学能力', 2, 10, 'studentCount', 1, 1, 1, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  (UUID(), 'student.export', '学员导出上限',   'quota',  '条', '教学能力', 3, 100, 'studentCount', 1, 1, 1, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  (UUID(), 'lock.max',       '并发锁定数',     'quota',  '个', '教学能力', 4, -1, 'lockCount',    1, 1, 1, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  (UUID(), 'report.export',  '报表导出',       'switch', NULL, '数据能力', 1, 0,  NULL,          1, 0, 1, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0)
AS new
ON DUPLICATE KEY UPDATE
  `name` = new.name,
  `kind` = new.kind,
  `unit` = new.unit,
  `group_name` = new.group_name,
  `sort_order` = new.sort_order,
  `default_value` = new.default_value,
  `resolver_key` = new.resolver_key,
  `admin_bypass` = new.admin_bypass,
  `user_show` = new.user_show,
  `status` = new.status;
*/


-- ============================================================================
-- Part 4：执行结果自检
-- 预期：功能目录 17 列 / 等级矩阵 9 列；菜单 6 行；授权 = 6×2 + 2 = 14 行
-- ============================================================================

-- 4.1 两张表的列清单（应与注释逐列一致；缺列/多列都在这里看得出来）
SELECT `TABLE_NAME` AS `表`, `COLUMN_NAME` AS `列`, `COLUMN_TYPE` AS `类型`,
       `IS_NULLABLE` AS `可空`, `COLUMN_DEFAULT` AS `默认值`, `COLUMN_COMMENT` AS `注释`
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('sys_member_feature', 'sys_member_level_feature')
ORDER BY `TABLE_NAME`, `ORDINAL_POSITION`;

-- 4.2 列数核对：sys_member_feature 应为 17、sys_member_level_feature 应为 9
SELECT `TABLE_NAME` AS `表`, COUNT(*) AS `列数`
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('sys_member_feature', 'sys_member_level_feature')
GROUP BY `TABLE_NAME`;

-- 4.3 索引核对：唯一键 / 普通索引是否齐全
SELECT `TABLE_NAME` AS `表`, `INDEX_NAME` AS `索引`, `NON_UNIQUE` AS `非唯一`, GROUP_CONCAT(`COLUMN_NAME` ORDER BY `SEQ_IN_INDEX`) AS `列`
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('sys_member_feature', 'sys_member_level_feature')
GROUP BY `TABLE_NAME`, `INDEX_NAME`, `NON_UNIQUE`
ORDER BY `TABLE_NAME`, `INDEX_NAME`;

-- 4.4 菜单行数：应为 6
SELECT COUNT(*) AS `功能与配额菜单行数(应为6)` FROM `sys_menu`
WHERE `id` IN (
  '10000000-0000-0000-0000-000000001071',
  '10000000-0000-0000-0000-000000001072',
  '10000000-0000-0000-0000-000000001073',
  '10000000-0000-0000-0000-000000001074',
  '10000000-0000-0000-0000-000000001075',
  '10000000-0000-0000-0000-000000001006'
);

-- 4.5 id 冲突核对：...1070~...1079 段只应有本脚本的 5 行；...1006 只应有 1 行
SELECT `id`, `parent_id`, `name`, `code`, `type`, `sort_order`
FROM `sys_menu`
WHERE `id` BETWEEN '10000000-0000-0000-0000-000000001070' AND '10000000-0000-0000-0000-000000001079'
ORDER BY `id`;

SELECT `id`, `parent_id`, `name`, `code`, `type`, `sort_order`
FROM `sys_menu`
WHERE `id` = '10000000-0000-0000-0000-000000001006';

-- 4.6 页面行核对（含目录内排序 sort_order，预期 8）
SELECT `id`, `parent_id`, `name`, `code`, `type`, `path`, `component`, `icon`, `sort_order`, `visible`, `status`
FROM `sys_menu`
WHERE `id` = '10000000-0000-0000-0000-000000001071';

-- 4.7 目录内页面排序全景（预期 1~8 连续，本页排最后）
SELECT `id`, `name`, `code`, `sort_order`
FROM `sys_menu`
WHERE `parent_id` = '10000000-0000-0000-0000-000000001000' AND `type` = 1
ORDER BY `sort_order`, `id`;

-- 4.8 会员等级页按钮全景（...1002~1005 既有 4 个 + ...1006 本脚本新增，预期 5 行）
SELECT `id`, `name`, `code`, `sort_order`
FROM `sys_menu`
WHERE `parent_id` = '10000000-0000-0000-0000-000000001001' AND `type` = 2
ORDER BY `sort_order`, `id`;

-- 4.9 授权行数：预期 dept_manager 6 / operator 6 / auditor 2
SELECT r.`code` AS `角色`, COUNT(*) AS `授权菜单数`
FROM `sys_role_menu` rm
JOIN `sys_role` r ON r.`id` = rm.`role_id`
WHERE rm.`menu_id` IN (
  '10000000-0000-0000-0000-000000001071',
  '10000000-0000-0000-0000-000000001072',
  '10000000-0000-0000-0000-000000001073',
  '10000000-0000-0000-0000-000000001074',
  '10000000-0000-0000-0000-000000001075',
  '10000000-0000-0000-0000-000000001006'
)
GROUP BY r.`code`
ORDER BY r.`code`;

-- 4.10 权限码清单（供后端路由 / 前端按钮逐一对齐）
SELECT `code`, `name`, `type`
FROM `sys_menu`
WHERE `id` IN (
  '10000000-0000-0000-0000-000000001071',
  '10000000-0000-0000-0000-000000001072',
  '10000000-0000-0000-0000-000000001073',
  '10000000-0000-0000-0000-000000001074',
  '10000000-0000-0000-0000-000000001075',
  '10000000-0000-0000-0000-000000001006'
)
ORDER BY `type`, `sort_order`, `id`;

-- 4.11 功能目录当前数据（Part 3 未执行时预期 0 行；执行后预期 5 行）
SELECT `feature_key` AS `功能键`, `name` AS `名称`, `kind` AS `类型`, `unit` AS `单位`,
       `group_name` AS `分组`, `default_value` AS `默认值`, `resolver_key` AS `计量键`,
       `admin_bypass` AS `管理员绕过`, `user_show` AS `用户可见`, `status` AS `状态`
FROM `sys_member_feature`
WHERE `is_deleted` = 0
ORDER BY `group_name`, `sort_order`, `feature_key`;

-- 4.12 等级矩阵行数（按等级分组；Part 3 未执行时预期 0 行）
SELECT `level_id` AS `等级ID`, COUNT(*) AS `已配置功能数`
FROM `sys_member_level_feature`
WHERE `is_deleted` = 0
GROUP BY `level_id`;
