-- ============================================================================
-- 交易模块（商品 / 服务 + 订单）：建表 + 菜单权限 + 定时任务（阶段 0 交付物）
--
-- 目标库：与 .env 的 DB_DATABASE 一致
-- 执行方式：整段执行；脚本只做「新增」，不改动任何既有表与既有数据
-- 执行顺序：Part 1 建表 → Part 2 菜单与权限 → Part 3 定时任务（默认禁用）
-- 执行完成后：用 drizzle-kit pull 生成 schema，再继续生成基础代码
-- 幂等性：重复执行会在主键/唯一键冲突处报错，属预期，不会写入脏数据
--
-- 已核对无冲突：sys_goods / sys_goods_level_price / sys_order 表 0 张、
--               菜单 id ...11xx 段 0 行、system:trade|goods|order|mall code 0 行、
--               order:expire-close 任务 0 条（sys_job 仅 ...2001~2004 会员任务）
--
-- 设计要点：
-- 1. 服务（如应用迁移）不建独立实体，用 sys_goods.type = 'service' 表达差异：
--    不扣库存（unlimited_stock=1）、需要联系方式、收款后由后台「交付」；
-- 2. 等级价单独一张表 sys_goods_level_price，未配置的等级回落到 sys_goods.price；
-- 3. 订单状态机 WP/OD/CL/FL 只描述资金，履约维度独立成 fulfill_status，
--    交付不涉及资金，避免与余额流水口径纠缠。
-- ============================================================================


-- ============================================================================
-- Part 1：建表（3 张）
-- ============================================================================

-- 1. 商品 / 服务
CREATE TABLE `sys_goods` (
  `id` varchar(36) NOT NULL COMMENT '主键',
  `name` varchar(100) NOT NULL COMMENT '商品名称',
  `subtitle` varchar(200) DEFAULT NULL COMMENT '副标题/卖点',
  `cover` varchar(500) DEFAULT NULL COMMENT '封面图URL',
  `price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '基础价(元)，会员未配等级价时使用',
  `stock` int NOT NULL DEFAULT '0' COMMENT '库存(不限库存时忽略)',
  `unlimited_stock` tinyint NOT NULL DEFAULT '0' COMMENT '是否不限库存: 0-否, 1-是',
  `sales_count` int NOT NULL DEFAULT '0' COMMENT '累计销量(支付完成后累加)',
  `type` varchar(20) NOT NULL DEFAULT 'virtual' COMMENT '类型: virtual-虚拟物品, service-人工服务, physical-实物(预留)',
  `service_notice` varchar(500) DEFAULT NULL COMMENT '服务类下单提示/交付说明(仅 service 使用)',
  `detail` text COMMENT '商品详情',
  `sort_order` int DEFAULT '0' COMMENT '显示排序',
  `status` tinyint DEFAULT '1' COMMENT '状态: 0-下架, 1-上架',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
  PRIMARY KEY (`id`),
  KEY `idx_goods_status` (`status`, `is_deleted`, `sort_order`),
  KEY `idx_goods_type` (`type`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品与服务';

-- 2. 商品等级价（一个商品 × 一个会员等级 一行；不配则用基础价）
CREATE TABLE `sys_goods_level_price` (
  `id` varchar(36) NOT NULL COMMENT '主键',
  `goods_id` varchar(36) NOT NULL COMMENT '商品ID(sys_goods.id)',
  `level_id` varchar(36) NOT NULL COMMENT '会员等级ID(sys_member_level.id)',
  `price` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '该等级专属价(元)',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_goods_level` (`goods_id`, `level_id`),
  KEY `idx_goods_level_goods` (`goods_id`, `is_deleted`),
  KEY `idx_goods_level_level` (`level_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品等级价';

-- 3. 交易订单（order 是 SQL 关键字，故表名用 sys_order）
CREATE TABLE `sys_order` (
  `id` varchar(36) NOT NULL COMMENT '主键',
  `order_no` varchar(64) NOT NULL COMMENT '订单号(同时作为支付单的商户订单号)',
  `request_id` varchar(64) NOT NULL COMMENT '下单幂等键(前端每次提交生成)',
  `user_id` varchar(36) NOT NULL COMMENT '下单会员用户ID(sys_user.id)',
  `goods_id` varchar(36) NOT NULL COMMENT '商品ID(sys_goods.id)',
  `goods_name` varchar(100) NOT NULL COMMENT '商品名称快照',
  `goods_cover` varchar(500) DEFAULT NULL COMMENT '商品封面快照',
  `goods_type` varchar(20) DEFAULT NULL COMMENT '商品类型快照: virtual/service/physical',
  `unit_price` decimal(12,2) NOT NULL COMMENT '成交单价快照(元)',
  `price_source` varchar(20) NOT NULL DEFAULT 'base' COMMENT '价格来源: base-基础价, level-等级价, member-会员协议价(预留)',
  `level_id` varchar(36) DEFAULT NULL COMMENT '下单时会员等级ID快照',
  `quantity` int NOT NULL DEFAULT '1' COMMENT '数量(服务类固定为1)',
  `total_amount` decimal(12,2) NOT NULL COMMENT '商品金额=成交单价*数量',
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '优惠码抵扣金额',
  `pay_amount` decimal(12,2) NOT NULL COMMENT '应付金额=商品金额-优惠抵扣',
  `gift_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '本单赠送金抵扣(余额支付冻结时回填)',
  `recharge_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '本单充值金抵扣(余额支付冻结时回填)',
  `pay_mode` varchar(20) NOT NULL DEFAULT 'balance' COMMENT '支付方式: balance-余额支付, online-在线支付',
  `status` varchar(10) NOT NULL DEFAULT 'WP' COMMENT '状态: WP-待支付, OD-已完成, CL-已关闭, FL-发起失败',
  `coupon_id` varchar(36) DEFAULT NULL COMMENT '使用的优惠码ID',
  `coupon_code` varchar(32) DEFAULT NULL COMMENT '使用的优惠码',
  `freeze_id` varchar(36) DEFAULT NULL COMMENT '关联冻结单ID(sys_member_freeze.id)',
  `pay_order_id` varchar(36) DEFAULT NULL COMMENT '关联支付单ID(sys_pay_order.id)',
  `pay_channel_code` varchar(30) DEFAULT NULL COMMENT '支付渠道编码',
  `contact` varchar(50) DEFAULT NULL COMMENT '服务类联系方式(服务类必填)',
  `fulfill_status` varchar(20) NOT NULL DEFAULT 'none' COMMENT '履约状态: none-无需交付, pending-待交付, delivered-已交付',
  `fulfilled_at` timestamp NULL DEFAULT NULL COMMENT '交付时间',
  `fulfill_remark` varchar(255) DEFAULT NULL COMMENT '交付说明',
  `fulfill_operator_id` varchar(36) DEFAULT NULL COMMENT '交付操作人ID',
  `expire_at` timestamp NULL DEFAULT NULL COMMENT '支付超时时间',
  `paid_at` timestamp NULL DEFAULT NULL COMMENT '支付时间',
  `finished_at` timestamp NULL DEFAULT NULL COMMENT '完成时间',
  `closed_at` timestamp NULL DEFAULT NULL COMMENT '关闭时间',
  `close_reason` varchar(255) DEFAULT NULL COMMENT '关闭原因',
  `fail_reason` varchar(500) DEFAULT NULL COMMENT '失败原因(发起支付失败等)',
  `remark` varchar(255) DEFAULT NULL COMMENT '用户需求说明/备注',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  UNIQUE KEY `uk_order_request` (`request_id`),
  KEY `idx_order_user` (`user_id`, `created_at`),
  KEY `idx_order_status` (`status`, `expire_at`),
  KEY `idx_order_fulfill` (`fulfill_status`, `created_at`),
  KEY `idx_order_goods` (`goods_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='交易订单';


-- ============================================================================
-- Part 2：菜单与权限（1 目录 + 4 页面 + 11 按钮权限 = 16 行）
-- 目录：交易中心（icon i-lucide-store，排在会员管理之后 sort_order=60）
-- 说明：商城 /system/mall 与我的订单 /system/my-orders 是会员自助页，
--       放在菜单里只为演示方便（页面本身不做路由级权限拦截），
--       头像菜单里另有入口，与 /system/wallet 一致。
-- ============================================================================

INSERT INTO `sys_menu`
  (`id`, `parent_id`, `name`, `code`, `type`, `path`, `component`, `icon`, `sort_order`, `visible`, `status`, `remark`, `created_by`, `updated_by`, `is_deleted`)
VALUES
  -- 目录
  ('10000000-0000-0000-0000-000000001100', NULL, '交易中心', 'system:trade', 0, NULL, NULL, 'i-lucide-store', 60, 0, 1, '商品、服务与订单', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),

  -- 商品管理
  ('10000000-0000-0000-0000-000000001101', '10000000-0000-0000-0000-000000001100', '商品管理', 'system:goods', 1, '/system/goods', 'system/goods/index', 'i-lucide-package', 1, 0, 1, '商品与服务维护（含等级价）', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001102', '10000000-0000-0000-0000-000000001101', '商品查询', 'system:goods:list', 2, NULL, NULL, NULL, 1, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001103', '10000000-0000-0000-0000-000000001101', '商品新增', 'system:goods:add', 2, NULL, NULL, NULL, 2, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001104', '10000000-0000-0000-0000-000000001101', '商品编辑', 'system:goods:edit', 2, NULL, NULL, NULL, 3, 1, 1, '含等级价维护', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001105', '10000000-0000-0000-0000-000000001101', '商品删除', 'system:goods:del', 2, NULL, NULL, NULL, 4, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),

  -- 订单管理
  ('10000000-0000-0000-0000-000000001111', '10000000-0000-0000-0000-000000001100', '订单管理', 'system:order', 1, '/system/order', 'system/order/index', 'i-lucide-shopping-bag', 2, 0, 1, '订单查询、确认、关闭与交付', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001112', '10000000-0000-0000-0000-000000001111', '订单查询', 'system:order:list', 2, NULL, NULL, NULL, 1, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001113', '10000000-0000-0000-0000-000000001111', '订单编辑', 'system:order:edit', 2, NULL, NULL, NULL, 2, 1, 1, '只允许改备注', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001114', '10000000-0000-0000-0000-000000001111', '订单删除', 'system:order:del', 2, NULL, NULL, NULL, 3, 1, 1, '仅已关闭/失败订单可删', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001115', '10000000-0000-0000-0000-000000001111', '确认支付', 'system:order:confirm', 2, NULL, NULL, NULL, 4, 1, 1, '余额单确认实扣', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001116', '10000000-0000-0000-0000-000000001111', '关闭订单', 'system:order:close', 2, NULL, NULL, NULL, 5, 1, 1, '释放冻结/优惠码/库存', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001117', '10000000-0000-0000-0000-000000001111', '同步支付状态', 'system:order:sync', 2, NULL, NULL, NULL, 6, 1, 1, '向渠道查询并推进订单', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001118', '10000000-0000-0000-0000-000000001111', '服务交付', 'system:order:fulfill', 2, NULL, NULL, NULL, 7, 1, 1, '服务类订单交付确认', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),

  -- 商城（自助）
  ('10000000-0000-0000-0000-000000001121', '10000000-0000-0000-0000-000000001100', '商城', 'system:mall', 1, '/system/mall', 'system/mall/index', 'i-lucide-store', 3, 0, 1, '会员自助下单页', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),

  -- 我的订单（自助）
  ('10000000-0000-0000-0000-000000001131', '10000000-0000-0000-0000-000000001100', '我的订单', 'system:myOrder', 1, '/system/my-orders', 'system/my-orders/index', 'i-lucide-receipt', 4, 0, 1, '会员自助订单页', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0);


-- ============================================================================
-- Part 3：定时任务（默认 status=0 禁用）
--
-- 注意：handler 会在「阶段 6」随代码注册到 server/sys-router/job/handlers.ts。
-- 在此之前请勿启用/手动触发，否则会报 module.system.job.handlerMissing（属预期）。
-- 阶段 6 完成后把 status 改为 1 即可参与调度；注意 nuxt.config.ts 的
-- nitro.scheduledTasks 目前仍是注释状态，自动调度默认不开。
-- ============================================================================

INSERT INTO `sys_job`
  (`id`, `job_name`, `job_code`, `handler_code`, `cron_expression`, `cron_timezone`, `status`, `running_status`, `sort_order`, `remark`, `created_by`, `updated_by`, `is_deleted`)
VALUES
  ('10000000-0000-0000-0000-000000002005', '关闭超时未支付订单', 'order:expire-close', 'order:expire-close', '0 0/5 * * * *', 'Asia/Shanghai', 0, 0, 5, '每 5 分钟关闭超过 expire_at 仍未支付的订单：释放冻结、释放优惠码、回滚库存', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0);


-- ============================================================================
-- Part 4：执行结果自检（直接执行，预期：3 张表 / 16 行菜单 / 1 条任务）
-- ============================================================================

SELECT COUNT(*) AS `新建表数(应为3)` FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN ('sys_goods', 'sys_goods_level_price', 'sys_order');

SELECT COUNT(*) AS `菜单行数(应为16)` FROM sys_menu
WHERE id LIKE '10000000-0000-0000-0000-0000000011%';

SELECT COUNT(*) AS `任务行数(应为1)` FROM sys_job
WHERE job_code = 'order:expire-close';

SHOW TABLES LIKE 'sys_goods%';
SHOW TABLES LIKE 'sys_order';
