-- ============================================================================
-- 会员等级价格 + 会员期限 + 会员开通单（数据模型层交付物）
--
-- 目标库：与 .env 的 DB_DATABASE 一致
-- 前置条件：会员模块既有表已就位（sys_member_level / sys_member 来自
--   doc/main/mysql-ddl-member-balance.sql），否则 1.1 / 1.2 的 ALTER 会因表不存在而报错
-- 执行方式：整段执行（Navicat / mysql 客户端均可；脚本含动态 SQL，需支持多语句执行）
-- 执行顺序：Part 1 表结构变更 → Part 2 定时任务（默认禁用）→ Part 3 自检
-- 配套脚本：后台「会员开通记录」页面与按钮权限（5 行菜单 + 角色授权）单独放在
--   doc/main/mysql-menu-member-level-order.sql，本脚本不碰菜单。
-- 执行完成后：**重启服务**（会员等级价格 / 默认等级 / 长期等级会被服务端读取，
--             等级相关缓存需随进程重建；drizzle schema 已同步，无需再 pull）
--
-- 幂等性：**本脚本可重复执行，不会报错**，与 doc/main/mysql-ddl-member-balance.sql
--   「冲突报错属预期」的约定不同，原因与做法如下：
--   1. 加列：DDL 的 ALTER TABLE ... ADD COLUMN 没有 IF NOT EXISTS（MySQL 8.0 不支持），
--      故用 information_schema.COLUMNS 计数做守卫 + PREPARE/EXECUTE 动态 SQL：
--      列已存在时改执行一条无害的 SELECT，不会中断脚本、也不会重复加列；
--   2. 建表：CREATE TABLE IF NOT EXISTS；为兼容「本脚本早期版本已建过该表」的情况，
--      1.3.2 另有一段 request_id 列 + uk_member_level_order_request 唯一键的守卫补齐段。
--      1.4 / 1.5 的 MODIFY COLUMN（列注释）分别用 COLUMN_COMMENT 是否已含 level_open / manual
--      做守卫，已含则跳过，避免每次执行都重建表。除此之外不会改动既有表结构；
--   3. 任务行：INSERT ... AS new ON DUPLICATE KEY UPDATE（MySQL 8.0.19+ 别名语法），
--      命中 id 主键或 job_code 唯一键时只覆盖展示字段，不会产生重复行。
--   注意：建表用 IF NOT EXISTS 意味着**不会**在已存在的表上补/改除 1.3.2 之外的列。若该表已存在
--   但不是本脚本定义的形态，请人工核对（Part 3 自检会暴露缺列/缺表）。本脚本**不改动任何既有列、
--   既有数据与既有菜单**，只做新增（仅有的两个例外是 1.4 与 1.5：只改
--   sys_member_balance_log.biz_type / sys_member_level_order.pay_mode 的列注释，
--   不动列定义、不动数据）。
--
--   **若你已执行过本脚本的旧版本**（例如 sys_member_level_order.pay_mode 的注释里
--   还没有 manual）：直接**重跑本脚本**即可对齐 —— 1.5 的守卫会命中并 MODIFY 一次注释，
--   1.3 的 CREATE TABLE IF NOT EXISTS 与 1.3.2 的守卫都会走 skip 分支，不会重复建表/加列，
--   也不会动任何既有数据。
--
-- 设计要点：
--   1. 「默认等级全局唯一」（is_default=1 只允许一行）**没有**唯一索引，因为 tinyint 上
--      建唯一索引会同时约束 0；由 Service 在写入口校验并保证唯一；
--   2. 「长期等级」（is_long_term=1）与「价格为 0」（price=0）的联动、以及
--      「price>0 ⇒ is_long_term=0 且 duration_days>=1」同样由 Service 校验，列上不加 CHECK；
--   3. **开通单的 requestId 幂等由单据级唯一键保证**：uk_member_level_order_request(request_id)
--      （与 sys_order.uk_order_request 同一套路），不再依赖「同用户+同等级+同支付方式的
--      未超时 WP 单复用」去兜底。注意 MySQL 唯一索引允许多个 NULL，故 request_id 为 NULL 的
--      行不参与唯一约束 —— 只有通过自助开通接口下发的单据才带该键（后台手工调整
--      `pay_mode = 'manual'` 的留痕单、后台补录与历史数据均为空值）。
--      业务侧仍应把 requestId 拼进冻结单 biz_no（`mlv:{requestId}`），让余额支付在资金层
--      也能幂等；
--   4. sys_member_level_order.expire_at 是**支付超时**，sys_member.expire_at 是**等级到期**，
--      两者语义不同，不要混用。
--
-- 本次**不新增/不修改任何字典表**；等级来源 level_source、单据状态 status/pay_mode 取值为
-- 代码内约定（见下方各列 COMMENT）。1.4 只是把新的钱包流水业务类型 level_open 补进
-- sys_member_balance_log.biz_type 的列注释，1.5 只是把新的支付方式取值 manual
-- （后台手工调整等级/期限的留痕单，不动钱）补进 sys_member_level_order.pay_mode 的列注释
-- （两者都只改注释；WalletService 与 MemberLevelOrderService 里「真正写出」这些取值属于后端代码改动）。
-- ============================================================================


-- ============================================================================
-- Part 1：表结构变更
--   1.1 sys_member_level 加 4 列（价格 / 时长 / 默认等级 / 长期等级）
--   1.2 sys_member 加 3 列（等级到期时间 / 等级生效时间 / 等级来源）
--   1.3 新表 sys_member_level_order（会员开通单，含 request_id 幂等唯一键）
--   1.4 sys_member_balance_log.biz_type 列注释补 level_open（只改注释，不改列定义）
--   1.5 sys_member_level_order.pay_mode 列注释补 manual（只改注释，不改列定义）
--
-- 说明：加列一律不写 AFTER，新列由 MySQL 追加到表末尾。这样守卫之间互不依赖，
--       任一列缺失时都能独立补齐（drizzle / ORM 按列名读写，与列顺序无关）。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1.1 sys_member_level 加列
-- ---------------------------------------------------------------------------

-- 1.1.1 price：等级售价（元）；0 表示免费等级
SET @ddl := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `sys_member_level` ADD COLUMN `price` decimal(12,2) NOT NULL DEFAULT ''0.00'' COMMENT ''等级售价（元）；0 表示免费等级''',
    'SELECT ''skip: sys_member_level.price 已存在'' AS `result`'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level' AND COLUMN_NAME = 'price'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 1.1.2 duration_days：购买一次的有效天数；0 表示不设期限（长期等级）
SET @ddl := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `sys_member_level` ADD COLUMN `duration_days` int NOT NULL DEFAULT 0 COMMENT ''购买一次的有效天数；0 表示不设期限（长期等级）''',
    'SELECT ''skip: sys_member_level.duration_days 已存在'' AS `result`'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level' AND COLUMN_NAME = 'duration_days'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 1.1.3 is_default：是否默认等级（全局唯一，新用户注册自动分配且永不过期）
SET @ddl := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `sys_member_level` ADD COLUMN `is_default` tinyint NOT NULL DEFAULT 0 COMMENT ''是否默认等级：1 是（全局唯一，新用户注册自动分配且永不过期）''',
    'SELECT ''skip: sys_member_level.is_default 已存在'' AS `result`'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level' AND COLUMN_NAME = 'is_default'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 1.1.4 is_long_term：是否长期等级（仅 price=0 可设，该等级会员永不过期）
SET @ddl := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `sys_member_level` ADD COLUMN `is_long_term` tinyint NOT NULL DEFAULT 0 COMMENT ''是否长期等级：1 是（仅 price=0 可设，该等级会员永不过期）''',
    'SELECT ''skip: sys_member_level.is_long_term 已存在'' AS `result`'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level' AND COLUMN_NAME = 'is_long_term'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 1.2 sys_member 加列
-- ---------------------------------------------------------------------------

-- 1.2.1 expire_at：当前等级到期时间；NULL 表示永不过期（长期/默认等级）
SET @ddl := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `sys_member` ADD COLUMN `expire_at` timestamp NULL DEFAULT NULL COMMENT ''当前等级到期时间；NULL 表示永不过期（长期/默认等级）''',
    'SELECT ''skip: sys_member.expire_at 已存在'' AS `result`'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member' AND COLUMN_NAME = 'expire_at'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 1.2.2 level_start_at：当前等级生效时间
SET @ddl := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `sys_member` ADD COLUMN `level_start_at` timestamp NULL DEFAULT NULL COMMENT ''当前等级生效时间''',
    'SELECT ''skip: sys_member.level_start_at 已存在'' AS `result`'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member' AND COLUMN_NAME = 'level_start_at'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 1.2.3 level_source：等级来源
--   取值：manual 后台手工指定 / open 新开通 / renew 续费 / upgrade 升级 /
--         default 注册默认分配 / auto_expire 到期降级（定时任务写入）
SET @ddl := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `sys_member` ADD COLUMN `level_source` varchar(20) NULL DEFAULT NULL COMMENT ''等级来源：manual/open/renew/upgrade/default/auto_expire''',
    'SELECT ''skip: sys_member.level_source 已存在'' AS `result`'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member' AND COLUMN_NAME = 'level_source'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 1.3 新表：会员开通单（等级购买 / 续费；与 sys_pay_order 通过 out_trade_no 对应）
--
-- 状态机：WP 待支付 → OD 已生效（等级已写回 sys_member） / CL 已关闭 / FL 失败。
-- 余额支付走 sys_member_freeze 冻结；在线支付走 sys_pay_order；
-- 价格=0 的免费等级不走任何支付，pay_mode=free，创建即 OD。
-- 单据级幂等：uk_member_level_order_request(request_id) 唯一键（与 sys_order.uk_order_request
--   同一套路）——同一 requestId 只允许一张开通单；request_id 为 NULL 的行不参与唯一约束
--   （MySQL 唯一索引允许多个 NULL），只有走自助开通接口下发的单据才会带该键。
-- 注意 expire_at 是**支付超时时间**，与 sys_member.expire_at（等级到期时间）语义不同；
--      本单产生的等级有效期区间记在 start_at / end_at。
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `sys_member_level_order` (
  `id` varchar(36) NOT NULL COMMENT '主键',
  `out_trade_no` varchar(64) NOT NULL COMMENT '商户订单号(与支付单一致，全表唯一)',
  `request_id` varchar(64) DEFAULT NULL COMMENT '下单请求幂等键（同一 requestId 只允许一张开通单）',
  `user_id` varchar(36) NOT NULL COMMENT '开通会员的用户ID(sys_user.id)',
  `level_id` varchar(36) NOT NULL COMMENT '开通的会员等级ID(sys_member_level.id)',
  `level_name` varchar(50) NOT NULL COMMENT '等级名称快照',
  `duration_days` int NOT NULL DEFAULT '0' COMMENT '本单时长天数快照(0=不设期限/长期)',
  `price_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '等级价快照(元)',
  `pay_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '实付金额(元)；0 元单直接生效',
  `pay_mode` varchar(20) NOT NULL DEFAULT 'balance' COMMENT '支付方式: balance-余额支付, online-在线支付, free-免费等级直接生效(不走支付), manual-后台手工调整等级/期限(不动钱，仅留开通流水)',
  `status` varchar(10) NOT NULL DEFAULT 'WP' COMMENT '状态: WP-待支付, OD-已生效, CL-已关闭, FL-失败',
  `freeze_id` varchar(36) DEFAULT NULL COMMENT '关联冻结单ID(sys_member_freeze.id)，余额支付使用',
  `pay_order_id` varchar(36) DEFAULT NULL COMMENT '关联支付单ID(sys_pay_order.id)，在线支付使用',
  `pay_channel_code` varchar(30) DEFAULT NULL COMMENT '支付渠道编码',
  `start_at` timestamp NULL DEFAULT NULL COMMENT '本单产生的等级生效开始时间',
  `end_at` timestamp NULL DEFAULT NULL COMMENT '本单产生的等级生效结束时间(NULL=长期/不设期限)',
  `paid_at` timestamp NULL DEFAULT NULL COMMENT '支付成功时间',
  `effective_at` timestamp NULL DEFAULT NULL COMMENT '等级实际生效时间(写回 sys_member 的时刻)',
  `expire_at` timestamp NULL DEFAULT NULL COMMENT '支付超时时间(语义与 sys_member.expire_at 不同：那是等级到期时间)',
  `fail_reason` varchar(500) DEFAULT NULL COMMENT '失败/关闭原因',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_member_level_order_out` (`out_trade_no`),
  UNIQUE KEY `uk_member_level_order_request` (`request_id`),
  KEY `idx_member_level_order_user` (`user_id`, `created_at`),
  KEY `idx_member_level_order_status` (`status`, `expire_at`),
  KEY `idx_member_level_order_pay` (`pay_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员开通单';

-- 1.3.2 兼容守卫：若 sys_member_level_order 由本脚本的**早期版本**建立
--       （缺 request_id 列 / 缺 uk_member_level_order_request 唯一键），在这里补齐。
--       全新执行时上面的 CREATE TABLE 已带上，两段守卫都会走 skip 分支，可安全重复执行。
--       注意：补唯一键前若表里已有重复的非空 request_id，ALTER 会失败，需先人工清理。
SET @ddl := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `sys_member_level_order` ADD COLUMN `request_id` varchar(64) NULL DEFAULT NULL COMMENT ''下单请求幂等键（同一 requestId 只允许一张开通单）''',
    'SELECT ''skip: sys_member_level_order.request_id 已存在'' AS `result`'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level_order' AND COLUMN_NAME = 'request_id'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(
    COUNT(DISTINCT INDEX_NAME) = 0,
    'ALTER TABLE `sys_member_level_order` ADD UNIQUE KEY `uk_member_level_order_request` (`request_id`)',
    'SELECT ''skip: uk_member_level_order_request 已存在'' AS `result`'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level_order'
    AND INDEX_NAME = 'uk_member_level_order_request'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ---------------------------------------------------------------------------
-- 1.4 钱包流水业务类型注释更新：新增 level_open（等级购买）
--
-- 背景：等级购买 / 续费的余额支付复用 WalletService 的 freeze + confirm，
--   流水 biz_type 原本只有 consume_freeze / consume_confirm，后台「余额流水」无法区分
--   「等级购买」与「商城消费」。这里把取值清单补上 level_open（后端波在写流水时使用）。
--
-- 幂等：MODIFY COLUMN 本身可重复执行；再用 COLUMN_COMMENT 是否已包含 level_open 做守卫，
--   已包含时跳过，避免每次执行都重建表。列定义（varchar(30) NOT NULL）与数据均不变。
-- 注意：本段只改注释。钱包侧「实际写出 level_open」属于后端波的代码改动。
--
-- 守卫条件说明：`COLUMN_COMMENT NOT LIKE '%level_open%'` 选出的是「**还没对齐**的行」，
--   因此必须是「有行才改」（`COUNT(*) > 0`）。旧版本这里写成了 `COUNT(*) = 0`，判断被写反，
--   结果是注释缺 level_open 时反而走 skip 分支、永远对不齐（本库现状即如此）；
--   本次一并修正，重跑本脚本即可真正补齐该注释。列不存在时 COUNT(*) 同样是 0，走 skip 不报错。
-- ---------------------------------------------------------------------------

SET @ddl := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `sys_member_balance_log` MODIFY COLUMN `biz_type` varchar(30) NOT NULL COMMENT ''业务类型: recharge/register_bonus/gift_system/gift_campaign/adjust/consume_freeze/consume_confirm/consume_release/consume_expire/gift_expire/level_open''',
    'SELECT ''skip: sys_member_balance_log.biz_type 注释已含 level_open'' AS `result`'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_balance_log' AND COLUMN_NAME = 'biz_type'
    AND COLUMN_COMMENT NOT LIKE '%level_open%'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ---------------------------------------------------------------------------
-- 1.5 开通单支付方式注释更新：新增 manual（后台手工调整等级 / 期限）
--
-- 背景：后台「会员管理」手工调整等级与期限时，会在 sys_member_level_order 补一条
--   pay_mode = 'manual' 的留痕单（status 直接是 OD，price_amount / pay_amount 均为 0.00，
--   freeze_id / pay_order_id / pay_channel_code / request_id 全为 NULL）——它**不动钱**，
--   只是让「会员开通记录」能完整反映等级变动来源。注册自动分配默认等级、到期自动降级
--   以及只改备注/状态的操作都不会写这条记录。
--   该列由 1.3 的 CREATE TABLE 建立，早期版本建表时的注释里没有 manual，故这里补一次。
--
-- 幂等：MODIFY COLUMN 本身可重复执行；再用 COLUMN_COMMENT 是否已包含 manual 做守卫，
--   已包含时跳过，避免每次执行都重建表。列定义（varchar(20) NOT NULL DEFAULT 'balance'）
--   与数据均不变；本段只改注释。
--   守卫条件与修正后的 1.4 同形：`NOT LIKE '%manual%'` 选「还没对齐的行」，`COUNT(*) > 0` 才改。
--   注意：表若不存在（1.3 未执行成功）本段会走 skip 分支（不报错），但那时 pay_mode 列本身
--   也不存在，请先确保 1.3 建表成功。
-- ---------------------------------------------------------------------------

SET @ddl := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `sys_member_level_order` MODIFY COLUMN `pay_mode` varchar(20) NOT NULL DEFAULT ''balance'' COMMENT ''支付方式: balance-余额支付, online-在线支付, free-免费等级直接生效(不走支付), manual-后台手工调整等级/期限(不动钱，仅留开通流水)''',
    'SELECT ''skip: sys_member_level_order.pay_mode 注释已含 manual'' AS `result`'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level_order' AND COLUMN_NAME = 'pay_mode'
    AND COLUMN_COMMENT NOT LIKE '%manual%'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ============================================================================
-- Part 2：定时任务（默认 status=0 禁用）
--
-- member:expire-level —— 会员等级到期降级：扫描 sys_member.expire_at <= NOW()
--   且未删除的档案，把等级回落到默认等级（sys_member_level.is_default=1）并写
--   level_source='auto_expire'、level_start_at=NOW()、expire_at=NULL。
--
-- 注意：handler 会在「会员价格/期限」这一波的代码里注册到
--   server/sys-router/job/handlers.ts。在此之前请勿手动触发，
--   否则会报 module.system.job.handlerMissing（属预期）。
--   注册完成后把 status 改为 1 即可参与调度（nitro.scheduledTasks 默认关闭，需另行开启）。
--
-- id 段 ...2006 为本脚本新增（...2001~2005 已被会员余额与交易模块占用），
-- 同样按 job_code 命中 uk_sys_job_code 做幂等 upsert。
-- ============================================================================

INSERT INTO `sys_job`
  (`id`, `job_name`, `job_code`, `handler_code`, `cron_expression`, `cron_timezone`, `status`, `running_status`, `sort_order`, `remark`, `created_by`, `updated_by`, `is_deleted`)
VALUES
  ('10000000-0000-0000-0000-000000002006', '会员等级到期降级', 'member:expire-level', 'member:expire-level', '0 0/10 * * * *', 'Asia/Shanghai', 0, 0, 5, '每 10 分钟扫描到期会员等级并回落到默认等级', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0)
AS new
ON DUPLICATE KEY UPDATE
  `job_name` = new.job_name,
  `job_code` = new.job_code,
  `handler_code` = new.handler_code,
  `cron_expression` = new.cron_expression,
  `cron_timezone` = new.cron_timezone,
  `status` = new.status,
  `sort_order` = new.sort_order,
  `remark` = new.remark,
  `updated_by` = new.updated_by,
  `is_deleted` = new.is_deleted;


-- ============================================================================
-- Part 3：执行结果自检（直接执行，预期：等级 4 列 / 会员 3 列 / 开通单 1 表 /
--   唯一索引 2 个 + 普通索引 3 个 / biz_type 注释含 level_open /
--   pay_mode 注释含 manual / 任务 1 条）
-- ============================================================================

-- 3.1 加列自检：应为 4
SELECT COUNT(*) AS `sys_member_level 新增列数(应为4)` FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level'
  AND COLUMN_NAME IN ('price', 'duration_days', 'is_default', 'is_long_term');

-- 3.2 加列自检：应为 3
SELECT COUNT(*) AS `sys_member 新增列数(应为3)` FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member'
  AND COLUMN_NAME IN ('expire_at', 'level_start_at', 'level_source');

-- 3.3 新表自检：应为 1
SELECT COUNT(*) AS `会员开通单表数(应为1)` FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level_order';

-- 3.4 biz_type 注释自检：应为 1（注释里已含 level_open）
SELECT COUNT(*) AS `biz_type 注释含 level_open(应为1)` FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_balance_log' AND COLUMN_NAME = 'biz_type'
  AND COLUMN_COMMENT LIKE '%level_open%';

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_balance_log' AND COLUMN_NAME = 'biz_type';

-- 3.4.1 pay_mode 注释自检：应为 1（注释里已含 manual，即 1.5 生效）
SELECT COUNT(*) AS `pay_mode 注释含 manual(应为1)` FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level_order' AND COLUMN_NAME = 'pay_mode'
  AND COLUMN_COMMENT LIKE '%manual%';

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level_order' AND COLUMN_NAME = 'pay_mode';

-- 3.5 索引自检：唯一索引应为 2（out_trade_no / request_id）
--     STATISTICS 每个索引按「列数」出行（复合索引出多行），故要 COUNT(DISTINCT INDEX_NAME)；
--     PRIMARY KEY 的 NON_UNIQUE 也是 0，靠 INDEX_NAME 白名单排除。
SELECT COUNT(DISTINCT INDEX_NAME) AS `开通单唯一索引数(应为2)` FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level_order'
  AND NON_UNIQUE = 0
  AND INDEX_NAME IN (
    'uk_member_level_order_out',
    'uk_member_level_order_request'
  );

-- 3.6 索引自检：普通索引应为 3（user / status / pay）
SELECT COUNT(DISTINCT INDEX_NAME) AS `开通单普通索引数(应为3)` FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level_order'
  AND NON_UNIQUE = 1
  AND INDEX_NAME IN (
    'idx_member_level_order_user',
    'idx_member_level_order_status',
    'idx_member_level_order_pay'
  );

-- 3.7 索引明细核对（预期：PRIMARY/唯一×2/普通×3）
SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_member_level_order'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- 3.8 定时任务自检：应为 1
SELECT COUNT(*) AS `到期降级任务数(应为1)` FROM sys_job
WHERE `job_code` = 'member:expire-level';

SELECT `id`, `job_code`, `handler_code`, `cron_expression`, `status`, `sort_order`
FROM `sys_job` WHERE `job_code` = 'member:expire-level';

-- 3.9 列清单核对（预期见上方各 COUNT；含新表 request_id 与 pay_mode 注释）
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (
    (TABLE_NAME = 'sys_member_level' AND COLUMN_NAME IN ('price', 'duration_days', 'is_default', 'is_long_term'))
    OR (TABLE_NAME = 'sys_member' AND COLUMN_NAME IN ('expire_at', 'level_start_at', 'level_source'))
    OR (TABLE_NAME = 'sys_member_level_order' AND COLUMN_NAME IN ('request_id', 'pay_mode'))
  )
ORDER BY TABLE_NAME, COLUMN_NAME;

SHOW TABLES LIKE 'sys_member_level%';


-- ============================================================================
-- Part 4：回滚说明（仅在确实需要撤销本次变更时人工执行；无自动化回滚脚本）
--
-- 4.1 删列（会丢失这些列的数据，执行前请备份）：
--   ALTER TABLE `sys_member_level` DROP COLUMN `price`;
--   ALTER TABLE `sys_member_level` DROP COLUMN `duration_days`;
--   ALTER TABLE `sys_member_level` DROP COLUMN `is_default`;
--   ALTER TABLE `sys_member_level` DROP COLUMN `is_long_term`;
--   ALTER TABLE `sys_member`       DROP COLUMN `expire_at`;
--   ALTER TABLE `sys_member`       DROP COLUMN `level_start_at`;
--   ALTER TABLE `sys_member`       DROP COLUMN `level_source`;
--
-- 4.2 删表（开通单数据不可恢复）：
--   DROP TABLE IF EXISTS `sys_member_level_order`;
--
-- 4.2.1 若只想撤销 requestId 幂等（保留开通单数据）：
--   ALTER TABLE `sys_member_level_order` DROP INDEX `uk_member_level_order_request`;
--   ALTER TABLE `sys_member_level_order` DROP COLUMN `request_id`;
--
-- 4.3 删任务行：
--   DELETE FROM `sys_job` WHERE `job_code` = 'member:expire-level';
--
-- 4.4 回滚 1.4 的 biz_type 注释（把 level_open 从注释里去掉，列定义与数据不变）：
--   ALTER TABLE `sys_member_balance_log` MODIFY COLUMN `biz_type` varchar(30) NOT NULL
--     COMMENT '业务类型: recharge/register_bonus/gift_system/gift_campaign/adjust/consume_freeze/consume_confirm/consume_release/consume_expire/gift_expire';
--
-- 4.5 回滚 1.5 的 pay_mode 注释（把 manual 从注释里去掉，列定义与数据不变）：
--   ALTER TABLE `sys_member_level_order` MODIFY COLUMN `pay_mode` varchar(20) NOT NULL DEFAULT 'balance'
--     COMMENT '支付方式: balance-余额支付, online-在线支付, free-免费等级直接生效(不走支付)';
--
-- 4.6 回滚后请一并回退代码侧的 drizzle schema 与 shared 契约改动，
--     并重启服务；本脚本没有触碰任何菜单与字典，无需回滚菜单。
--     注意：回退代码后，库里已经写入的 pay_mode = 'manual' 历史行仍然保留（那是既成事实的留痕），
--     列表里会因缺少文案而直接展示原始取值 manual。
-- ============================================================================
