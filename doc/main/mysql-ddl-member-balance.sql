-- ============================================================================
-- 会员 / 余额模块：建表 + 菜单权限 + 定时任务（阶段 0 交付物）
--
-- 目标库：与 .env 的 DB_DATABASE 一致
-- 执行方式：整段执行；脚本只做「新增」，不改动任何既有表与既有数据
-- 执行顺序：Part 1 建表 → Part 2 菜单与权限 → Part 3 定时任务（默认禁用）
-- 执行完成后：执行 `pnpm db:pull` 生成 schema，再继续生成基础代码
-- 幂等性：重复执行会在主键/唯一键冲突处报错，属预期，不会写入脏数据
--
-- 已核对无冲突：sys_member* 表 0 张、菜单 id ...10xx 段 0 行、member:* 任务 0 条
-- ============================================================================


-- ============================================================================
-- Part 1：建表（10 张）
-- ============================================================================

-- 1. 会员等级（仅后台手工指定，不含自动晋升与折扣权益）
CREATE TABLE `sys_member_level` (
  `id` varchar(36) NOT NULL COMMENT '主键',
  `code` varchar(50) NOT NULL COMMENT '等级编码',
  `name` varchar(50) NOT NULL COMMENT '等级名称',
  `sort_order` int DEFAULT '0' COMMENT '显示排序',
  `benefit` varchar(500) DEFAULT NULL COMMENT '等级权益说明',
  `status` tinyint DEFAULT '1' COMMENT '状态: 0-禁用, 1-启用',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_member_level_code` (`code`),
  KEY `idx_member_level_status` (`status`, `is_deleted`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员等级';

-- 2. 会员档案（一个 sys_user 一行；单级邀请关系）
CREATE TABLE `sys_member` (
  `id` varchar(36) NOT NULL COMMENT '主键',
  `user_id` varchar(36) NOT NULL COMMENT '会员用户ID(sys_user.id)',
  `level_id` varchar(36) DEFAULT NULL COMMENT '会员等级ID',
  `level_changed_at` timestamp NULL DEFAULT NULL COMMENT '等级变更时间',
  `level_remark` varchar(255) DEFAULT NULL COMMENT '等级变更原因',
  `invite_code` varchar(20) NOT NULL COMMENT '本人邀请码',
  `inviter_id` varchar(36) DEFAULT NULL COMMENT '上级用户ID(仅单级)',
  `invite_code_id` varchar(36) DEFAULT NULL COMMENT '注册时使用的邀请码ID',
  `invited_at` timestamp NULL DEFAULT NULL COMMENT '绑定上级时间',
  `status` tinyint DEFAULT '1' COMMENT '状态: 0-禁用, 1-启用',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_member_user` (`user_id`),
  UNIQUE KEY `uk_member_invite_code` (`invite_code`),
  KEY `idx_member_inviter` (`inviter_id`),
  KEY `idx_member_level` (`level_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员档案';

-- 3. 邀请码（owner_user_id 为空表示系统通用码）
CREATE TABLE `sys_member_invite_code` (
  `id` varchar(36) NOT NULL COMMENT '主键',
  `code` varchar(20) NOT NULL COMMENT '邀请码',
  `owner_user_id` varchar(36) DEFAULT NULL COMMENT '归属会员ID(空=系统通用码)',
  `source` varchar(30) NOT NULL DEFAULT 'system' COMMENT '来源: system-系统发放, member-会员专属',
  `max_use` int NOT NULL DEFAULT '0' COMMENT '最大使用次数(0=不限)',
  `used_count` int NOT NULL DEFAULT '0' COMMENT '已使用次数',
  `expire_at` timestamp NULL DEFAULT NULL COMMENT '过期时间(空=永久)',
  `status` tinyint DEFAULT '1' COMMENT '状态: 0-禁用, 1-启用',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_member_invite_code_code` (`code`),
  KEY `idx_member_invite_owner` (`owner_user_id`),
  KEY `idx_member_invite_status` (`status`, `is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员邀请码';

-- 4. 优惠码（原「折扣码」，充值/消费时抵扣；batch_no 承载原「折扣活动」标注）
CREATE TABLE `sys_member_coupon` (
  `id` varchar(36) NOT NULL COMMENT '主键',
  `code` varchar(32) NOT NULL COMMENT '优惠码',
  `name` varchar(50) DEFAULT NULL COMMENT '优惠码名称',
  `type` varchar(20) NOT NULL DEFAULT 'amount' COMMENT '类型: amount-固定金额, rate-折扣率',
  `value` decimal(12,2) NOT NULL COMMENT '面值: 固定金额(元) 或 折扣率(0-1, 0.90=九折)',
  `min_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '使用门槛: 订单金额下限',
  `scene` varchar(20) NOT NULL DEFAULT 'all' COMMENT '适用场景: recharge-充值, consume-消费, all-通用',
  `gift_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '附带赠送金(充值场景生效)',
  `valid_from` timestamp NULL DEFAULT NULL COMMENT '生效时间(空=立即)',
  `valid_to` timestamp NULL DEFAULT NULL COMMENT '失效时间(空=永久)',
  `max_use` int NOT NULL DEFAULT '0' COMMENT '总使用次数上限(0=不限)',
  `used_count` int NOT NULL DEFAULT '0' COMMENT '已使用次数',
  `per_user_limit` int NOT NULL DEFAULT '1' COMMENT '每用户可用次数(0=不限)',
  `batch_no` varchar(50) DEFAULT NULL COMMENT '活动批次号(折扣活动标注)',
  `status` tinyint DEFAULT '1' COMMENT '状态: 0-禁用, 1-启用, 2-已作废',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_member_coupon_code` (`code`),
  KEY `idx_member_coupon_scene` (`scene`, `status`, `is_deleted`),
  KEY `idx_member_coupon_batch` (`batch_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员优惠码';

-- 5. 优惠码使用记录（locked → used / released，与冻结单、充值单状态机联动）
CREATE TABLE `sys_member_coupon_use` (
  `id` varchar(36) NOT NULL COMMENT '主键',
  `coupon_id` varchar(36) NOT NULL COMMENT '优惠码ID',
  `coupon_code` varchar(32) NOT NULL COMMENT '优惠码(冗余便于查询)',
  `user_id` varchar(36) NOT NULL COMMENT '使用人ID',
  `scene` varchar(20) NOT NULL COMMENT '使用场景: recharge/consume',
  `biz_no` varchar(64) NOT NULL COMMENT '业务单号(充值单号/冻结单号)',
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '抵扣金额',
  `gift_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '附带赠送金',
  `status` varchar(20) NOT NULL DEFAULT 'locked' COMMENT '状态: locked-已锁定, used-已使用, released-已释放',
  `used_at` timestamp NULL DEFAULT NULL COMMENT '核销时间',
  `released_at` timestamp NULL DEFAULT NULL COMMENT '释放时间',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_member_coupon_use` (`coupon_id`, `biz_no`),
  KEY `idx_member_coupon_use_user` (`user_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员优惠码使用记录';

-- 6. 会员钱包（双账 + 冻结；可用余额 = 充值金-冻结充值金 + 赠送金-冻结赠送金）
CREATE TABLE `sys_member_wallet` (
  `id` varchar(36) NOT NULL COMMENT '主键',
  `user_id` varchar(36) NOT NULL COMMENT '会员用户ID',
  `currency` varchar(10) NOT NULL DEFAULT 'CNY' COMMENT '币种',
  `recharge_balance` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '充值金余额',
  `gift_balance` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '赠送金余额',
  `frozen_recharge` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '冻结中的充值金',
  `frozen_gift` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '冻结中的赠送金',
  `total_recharge` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '累计充值(实付)',
  `total_gift` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '累计受赠',
  `total_consume` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '累计消费(已确认实扣)',
  `version` int NOT NULL DEFAULT '0' COMMENT '乐观锁版本',
  `status` tinyint DEFAULT '1' COMMENT '状态: 0-冻结, 1-正常',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_member_wallet_user` (`user_id`),
  KEY `idx_member_wallet_status` (`status`, `is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员钱包(双账)';

-- 7. 赠送金批次（按批过期；扣减按 expire_at 升序先到期先扣）
CREATE TABLE `sys_member_gift_grant` (
  `id` varchar(36) NOT NULL COMMENT '主键',
  `user_id` varchar(36) NOT NULL COMMENT '会员用户ID',
  `amount` decimal(12,2) NOT NULL COMMENT '发放金额',
  `remain_amount` decimal(12,2) NOT NULL COMMENT '剩余可用金额',
  `source` varchar(30) NOT NULL COMMENT '来源: register-注册赠金, system-系统赠送, campaign-活动赠送',
  `expire_at` timestamp NULL DEFAULT NULL COMMENT '过期时间(空=永久有效)',
  `biz_no` varchar(64) NOT NULL COMMENT '业务单号(幂等键)',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '状态: active-有效, used-已用完, expired-已过期',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_member_gift_biz` (`biz_no`),
  KEY `idx_member_gift_user` (`user_id`, `status`, `expire_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员赠送金批次';

-- 8. 余额流水（只增不改；dedup_key 保证同一业务事件只入账一次）
CREATE TABLE `sys_member_balance_log` (
  `id` varchar(36) NOT NULL COMMENT '主键',
  `user_id` varchar(36) NOT NULL COMMENT '会员用户ID',
  `account` varchar(20) NOT NULL COMMENT '账户: recharge-充值金, gift-赠送金',
  `direction` varchar(10) NOT NULL COMMENT '方向: in-收入, out-支出',
  `amount` decimal(12,2) NOT NULL COMMENT '发生金额(正数)',
  `balance_before` decimal(12,2) NOT NULL COMMENT '发生前余额',
  `balance_after` decimal(12,2) NOT NULL COMMENT '发生后余额',
  `biz_type` varchar(30) NOT NULL COMMENT '业务类型: recharge/register_bonus/gift_system/gift_campaign/adjust/consume_freeze/consume_confirm/consume_release/consume_expire/gift_expire',
  `biz_no` varchar(64) NOT NULL COMMENT '业务单号',
  `dedup_key` varchar(128) NOT NULL COMMENT '幂等键(唯一)',
  `operator_id` varchar(36) DEFAULT NULL COMMENT '操作人ID(手工调账等后台操作)',
  `reason` varchar(255) DEFAULT NULL COMMENT '原因(手工调账必填)',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_member_log_dedup` (`dedup_key`),
  KEY `idx_member_log_user` (`user_id`, `created_at`),
  KEY `idx_member_log_biz` (`biz_type`, `biz_no`),
  KEY `idx_member_log_account` (`account`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员余额流水';

-- 9. 消费冻结单（预扣 → 确认实扣 / 释放；失败或超时释放即「失败不扣余额」）
CREATE TABLE `sys_member_freeze` (
  `id` varchar(36) NOT NULL COMMENT '主键',
  `biz_no` varchar(64) NOT NULL COMMENT '业务单号(由业务模块提供)',
  `user_id` varchar(36) NOT NULL COMMENT '会员用户ID',
  `amount` decimal(12,2) NOT NULL COMMENT '冻结总额',
  `gift_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '其中赠送金',
  `recharge_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '其中充值金',
  `status` varchar(20) NOT NULL DEFAULT 'FROZEN' COMMENT '状态: FROZEN-冻结中, CONFIRMED-已确认实扣, RELEASED-已释放, EXPIRED-超时释放',
  `subject` varchar(200) DEFAULT NULL COMMENT '业务标题',
  `attach` varchar(255) DEFAULT NULL COMMENT '业务附加信息',
  `expire_at` timestamp NULL DEFAULT NULL COMMENT '冻结超时时间',
  `confirmed_at` timestamp NULL DEFAULT NULL COMMENT '确认时间',
  `released_at` timestamp NULL DEFAULT NULL COMMENT '释放时间',
  `release_reason` varchar(255) DEFAULT NULL COMMENT '释放原因',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_member_freeze_biz` (`biz_no`),
  KEY `idx_member_freeze_user` (`user_id`, `status`),
  KEY `idx_member_freeze_expire` (`status`, `expire_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员消费冻结单';

-- 10. 充值记录（与 sys_pay_order 通过 out_trade_no 一一对应）
CREATE TABLE `sys_member_recharge` (
  `id` varchar(36) NOT NULL COMMENT '主键',
  `out_trade_no` varchar(64) NOT NULL COMMENT '商户订单号(与支付单一致)',
  `user_id` varchar(36) NOT NULL COMMENT '会员用户ID',
  `amount` decimal(12,2) NOT NULL COMMENT '充值金额(计入充值金)',
  `gift_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '赠送金',
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '优惠抵扣',
  `pay_amount` decimal(12,2) NOT NULL COMMENT '应付金额(实付)',
  `coupon_id` varchar(36) DEFAULT NULL COMMENT '使用的优惠码ID',
  `coupon_code` varchar(32) DEFAULT NULL COMMENT '使用的优惠码',
  `status` varchar(10) NOT NULL DEFAULT 'WP' COMMENT '状态: WP-待支付, OD-已支付已到账, CL-已关闭, FL-失败',
  `pay_order_id` varchar(36) DEFAULT NULL COMMENT '支付单ID(sys_pay_order.id)',
  `pay_channel_code` varchar(30) DEFAULT NULL COMMENT '支付渠道标识',
  `paid_at` timestamp NULL DEFAULT NULL COMMENT '支付成功时间',
  `credited_at` timestamp NULL DEFAULT NULL COMMENT '余额到账时间',
  `expire_at` timestamp NULL DEFAULT NULL COMMENT '支付超时时间',
  `fail_reason` varchar(500) DEFAULT NULL COMMENT '失败/关闭原因',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_member_recharge_out` (`out_trade_no`),
  KEY `idx_member_recharge_user` (`user_id`, `created_at`),
  KEY `idx_member_recharge_status` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员充值记录';


-- ============================================================================
-- Part 2：菜单与权限（1 目录 + 6 页面 + 30 按钮权限）
-- 目录：会员管理（icon i-lucide-users，排在支付管理之后 sort_order=40）
-- 说明：个人中心式的自助页 /system/wallet（我的余额）不进菜单，与 /system/user/profile 一致
-- ============================================================================

INSERT INTO `sys_menu`
  (`id`, `parent_id`, `name`, `code`, `type`, `path`, `component`, `icon`, `sort_order`, `visible`, `status`, `remark`, `created_by`, `updated_by`, `is_deleted`)
VALUES
  -- 目录
  ('10000000-0000-0000-0000-000000001000', NULL, '会员管理', 'system:memberCenter', 0, NULL, NULL, 'i-lucide-users', 40, 0, 1, '会员与余额管理目录', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),

  -- 会员等级
  ('10000000-0000-0000-0000-000000001001', '10000000-0000-0000-0000-000000001000', '会员等级', 'system:memberLevel', 1, '/system/member-level', 'system/member-level/index', 'i-lucide-crown', 1, 0, 1, '会员等级维护', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001002', '10000000-0000-0000-0000-000000001001', '等级查询', 'system:memberLevel:list', 2, NULL, NULL, NULL, 1, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001003', '10000000-0000-0000-0000-000000001001', '等级新增', 'system:memberLevel:add', 2, NULL, NULL, NULL, 2, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001004', '10000000-0000-0000-0000-000000001001', '等级编辑', 'system:memberLevel:edit', 2, NULL, NULL, NULL, 3, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001005', '10000000-0000-0000-0000-000000001001', '等级删除', 'system:memberLevel:del', 2, NULL, NULL, NULL, 4, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),

  -- 会员管理
  ('10000000-0000-0000-0000-000000001011', '10000000-0000-0000-0000-000000001000', '会员管理', 'system:member', 1, '/system/member', 'system/member/index', 'i-lucide-users-round', 2, 0, 1, '会员档案与余额总览', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001012', '10000000-0000-0000-0000-000000001011', '会员查询', 'system:member:list', 2, NULL, NULL, NULL, 1, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001013', '10000000-0000-0000-0000-000000001011', '会员新增', 'system:member:add', 2, NULL, NULL, NULL, 2, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001014', '10000000-0000-0000-0000-000000001011', '会员编辑', 'system:member:edit', 2, NULL, NULL, NULL, 3, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001015', '10000000-0000-0000-0000-000000001011', '会员删除', 'system:member:del', 2, NULL, NULL, NULL, 4, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001016', '10000000-0000-0000-0000-000000001011', '手工调账', 'system:member:adjust', 2, NULL, NULL, NULL, 5, 1, 1, '加/减余额，必填原因', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001017', '10000000-0000-0000-0000-000000001011', '发放赠送/优惠码', 'system:member:grant', 2, NULL, NULL, NULL, 6, 1, 1, '发放赠送金与优惠码', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001018', '10000000-0000-0000-0000-000000001011', '修改会员等级', 'system:member:level', 2, NULL, NULL, NULL, 7, 1, 1, '手工指定会员等级', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),

  -- 优惠码管理
  ('10000000-0000-0000-0000-000000001021', '10000000-0000-0000-0000-000000001000', '优惠码管理', 'system:memberCoupon', 1, '/system/member-coupon', 'system/member-coupon/index', 'i-lucide-ticket-percent', 3, 0, 1, '优惠码(折扣码)管理', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001022', '10000000-0000-0000-0000-000000001021', '优惠码查询', 'system:memberCoupon:list', 2, NULL, NULL, NULL, 1, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001023', '10000000-0000-0000-0000-000000001021', '优惠码新增', 'system:memberCoupon:add', 2, NULL, NULL, NULL, 2, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001024', '10000000-0000-0000-0000-000000001021', '优惠码编辑', 'system:memberCoupon:edit', 2, NULL, NULL, NULL, 3, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001025', '10000000-0000-0000-0000-000000001021', '优惠码删除', 'system:memberCoupon:del', 2, NULL, NULL, NULL, 4, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001026', '10000000-0000-0000-0000-000000001021', '优惠码作废', 'system:memberCoupon:void', 2, NULL, NULL, NULL, 5, 1, 1, '作废后不可再使用', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),

  -- 充值记录
  ('10000000-0000-0000-0000-000000001031', '10000000-0000-0000-0000-000000001000', '充值记录', 'system:memberRecharge', 1, '/system/member-recharge', 'system/member-recharge/index', 'i-lucide-hand-coins', 4, 0, 1, '会员充值记录', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001032', '10000000-0000-0000-0000-000000001031', '充值查询', 'system:memberRecharge:list', 2, NULL, NULL, NULL, 1, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001033', '10000000-0000-0000-0000-000000001031', '发起充值', 'system:memberRecharge:add', 2, NULL, NULL, NULL, 2, 1, 1, '发起/重新发起充值', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001034', '10000000-0000-0000-0000-000000001031', '充值编辑', 'system:memberRecharge:edit', 2, NULL, NULL, NULL, 3, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001035', '10000000-0000-0000-0000-000000001031', '充值删除', 'system:memberRecharge:del', 2, NULL, NULL, NULL, 4, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001036', '10000000-0000-0000-0000-000000001031', '关闭充值单', 'system:memberRecharge:close', 2, NULL, NULL, NULL, 5, 1, 1, '仅待支付可关闭', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),

  -- 消费冻结单
  ('10000000-0000-0000-0000-000000001041', '10000000-0000-0000-0000-000000001000', '消费冻结单', 'system:memberFreeze', 1, '/system/member-freeze', 'system/member-freeze/index', 'i-lucide-snowflake', 5, 0, 1, '业务消费预扣与释放', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001042', '10000000-0000-0000-0000-000000001041', '冻结查询', 'system:memberFreeze:list', 2, NULL, NULL, NULL, 1, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001043', '10000000-0000-0000-0000-000000001041', '冻结编辑', 'system:memberFreeze:edit', 2, NULL, NULL, NULL, 2, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001044', '10000000-0000-0000-0000-000000001041', '冻结删除', 'system:memberFreeze:del', 2, NULL, NULL, NULL, 3, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001045', '10000000-0000-0000-0000-000000001041', '强制释放', 'system:memberFreeze:release', 2, NULL, NULL, NULL, 4, 1, 1, '释放冻结中的余额', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),

  -- 余额流水
  ('10000000-0000-0000-0000-000000001051', '10000000-0000-0000-0000-000000001000', '余额流水', 'system:memberBalanceLog', 1, '/system/member-balance-log', 'system/member-balance-log/index', 'i-lucide-scroll-text', 6, 0, 1, '余额流水与对账', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001052', '10000000-0000-0000-0000-000000001051', '流水查询', 'system:memberBalanceLog:list', 2, NULL, NULL, NULL, 1, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001053', '10000000-0000-0000-0000-000000001051', '流水编辑', 'system:memberBalanceLog:edit', 2, NULL, NULL, NULL, 2, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001054', '10000000-0000-0000-0000-000000001051', '流水删除', 'system:memberBalanceLog:del', 2, NULL, NULL, NULL, 3, 1, 1, NULL, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001055', '10000000-0000-0000-0000-000000001051', '余额对账', 'system:memberBalanceLog:reconcile', 2, NULL, NULL, NULL, 4, 1, 1, '一致性校验与充值补偿', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000001056', '10000000-0000-0000-0000-000000001051', '流水导出', 'system:memberBalanceLog:export', 2, NULL, NULL, NULL, 5, 1, 1, '导出 CSV', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0);


-- ============================================================================
-- Part 3：定时任务（默认 status=0 禁用）
--
-- 注意：这 4 个 handler 会在「阶段 7」随代码注册到 server/sys-router/job/handlers.ts。
-- 在此之前请勿启用/手动触发，否则会报 module.system.job.handlerMissing（属预期）。
-- 阶段 7 完成后，把 status 改为 1 即可参与调度（nitro.scheduledTasks 默认关闭，需另行开启）。
-- ============================================================================

INSERT INTO `sys_job`
  (`id`, `job_name`, `job_code`, `handler_code`, `cron_expression`, `cron_timezone`, `status`, `running_status`, `sort_order`, `remark`, `created_by`, `updated_by`, `is_deleted`)
VALUES
  ('10000000-0000-0000-0000-000000002001', '释放超时冻结单', 'member:expire-freeze', 'member:expire-freeze', '0 0/10 * * * *', 'Asia/Shanghai', 0, 0, 1, '每 10 分钟释放超过 expire_at 仍未确认的消费冻结单', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000002002', '赠送金过期处理', 'member:expire-gift', 'member:expire-gift', '0 10 1 * * *', 'Asia/Shanghai', 0, 0, 2, '每天 01:10 处理过期赠送金批次并写过期扣减流水', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000002003', '会员档案回填', 'member:backfill-profile', 'member:backfill-profile', '0 30 2 * * *', 'Asia/Shanghai', 0, 0, 3, '每天 02:30 为历史 sys_user 补齐会员档案并补发注册赠金（幂等）', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0),
  ('10000000-0000-0000-0000-000000002004', '余额日对账', 'member:reconcile', 'member:reconcile', '0 0 3 * * *', 'Asia/Shanghai', 0, 0, 4, '每天 03:00 一致性巡检并补偿未到账充值', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0);


-- ============================================================================
-- Part 4：执行结果自检（直接执行，预期：10 张表 / 37 行菜单 / 4 条任务）
-- ============================================================================

SELECT COUNT(*) AS `新建表数(应为10)` FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_name LIKE 'sys_member%';

SELECT COUNT(*) AS `菜单行数(应为37)` FROM sys_menu
WHERE id LIKE '10000000-0000-0000-0000-000000001%';

SELECT COUNT(*) AS `任务行数(应为4)` FROM sys_job
WHERE job_code LIKE 'member:%';

SHOW TABLES LIKE 'sys_member%';
