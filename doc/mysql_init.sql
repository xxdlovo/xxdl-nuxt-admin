

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- 1. 部门管理表
-- ----------------------------
CREATE TABLE `sys_department` (
                                  `id` varchar(36) NOT NULL COMMENT '主键UUID',
                                  `name` varchar(50) NOT NULL COMMENT '部门名称',
                                  `code` varchar(50) NOT NULL COMMENT '部门编码',
                                  `parent_id` varchar(36) DEFAULT NULL COMMENT '父部门ID',
                                  `path` varchar(255) DEFAULT NULL COMMENT '层级路径',
                                  `level` int DEFAULT 0 COMMENT '部门层级',
                                  `sort_order` int DEFAULT 0 COMMENT '显示排序',
                                  `leader` varchar(50) DEFAULT NULL COMMENT '负责人',
                                  `phone` varchar(20) DEFAULT NULL COMMENT '联系电话',
                                  `email` varchar(100) DEFAULT NULL COMMENT '联系邮箱',
    -- 统一审计字段
                                  `status` tinyint DEFAULT 1 COMMENT '状态: 0-禁用, 1-启用',
                                  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                                  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                                  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                                  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                                  `is_deleted` tinyint DEFAULT 0 COMMENT '是否删除: 0-否, 1-是',
                                  PRIMARY KEY (`id`),
                                  UNIQUE KEY `uk_dept_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部门管理表';

-- ----------------------------
-- 2. 用户信息表
-- ----------------------------
CREATE TABLE `sys_user` (
                            `id` varchar(36) NOT NULL COMMENT '主键UUID',
                            `username` varchar(50) NOT NULL COMMENT '登录账号',
                            `password` varchar(255) NOT NULL COMMENT '登录密码',
                            `email` varchar(100) NOT NULL COMMENT '用户邮箱',
                            `nickname` varchar(50) DEFAULT NULL COMMENT '用户昵称',
                            `avatar` varchar(255) DEFAULT NULL COMMENT '用户头像',
                            `phone` varchar(20) DEFAULT NULL COMMENT '手机号码',
                            `gender` tinyint DEFAULT 0 COMMENT '性别: 0-未知, 1-男, 2-女',
                            `dept_id` varchar(36) DEFAULT NULL COMMENT '部门ID',
                            `is_admin` tinyint DEFAULT 0 COMMENT '是否管理员: 0-否, 1-是',
                            `last_login_time` timestamp NULL DEFAULT NULL COMMENT '最后登录时间',
                            `last_login_ip` varchar(50) DEFAULT NULL COMMENT '最后登录IP',
                            `status` tinyint DEFAULT 1 COMMENT '帐号状态: 1-启用, 2-禁用',
                            `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                            `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                            `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                            `is_deleted` tinyint DEFAULT 0 COMMENT '是否删除: 0-否, 1-是',
                            PRIMARY KEY (`id`),
                            UNIQUE KEY `uk_user_username` (`username`),
                            UNIQUE KEY `uk_user_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户信息表';

-- ----------------------------
-- 3. 角色信息表
-- ----------------------------
CREATE TABLE `sys_role` (
                            `id` varchar(36) NOT NULL COMMENT '主键UUID',
                            `name` varchar(50) NOT NULL COMMENT '角色名称',
                            `code` varchar(50) NOT NULL COMMENT '角色权限字符串',
                            `description` text COMMENT '描述',
                            `is_system` tinyint DEFAULT 0 COMMENT '是否系统内置: 0-否, 1-是',
                            `sort_order` int DEFAULT 0 COMMENT '显示顺序',
                            `status` tinyint DEFAULT 1 COMMENT '角色状态: 0-禁用, 1-启用',
                            `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                            `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                            `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                            `is_deleted` tinyint DEFAULT 0 COMMENT '是否删除: 0-否, 1-是',
                            PRIMARY KEY (`id`),
                            UNIQUE KEY `uk_role_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色信息表';

-- ----------------------------
-- 4. 菜单权限表
-- ----------------------------
DROP TABLE IF EXISTS `sys_menu`;
CREATE TABLE `sys_menu` (
                            `id` varchar(36) NOT NULL COMMENT '主键UUID',
                            `parent_id` varchar(36) DEFAULT NULL COMMENT '父菜单ID',
                            `name` varchar(50) NOT NULL COMMENT '菜单名称',
                            `code` varchar(50) NOT NULL COMMENT '权限标识',
                            `type` tinyint NOT NULL COMMENT '菜单类型: 0-目录, 1-菜单, 2-按钮',
                            `path` varchar(255) DEFAULT NULL COMMENT '路由地址',
                            `component` varchar(255) DEFAULT NULL COMMENT '组件路径',
                            `icon` varchar(50) DEFAULT NULL COMMENT '菜单图标',
                            `sort_order` int DEFAULT 0 COMMENT '显示顺序',
                            `visible` tinyint DEFAULT 1 COMMENT '显示状态: 0-隐藏, 1-显示',
                            `status` tinyint DEFAULT 1 COMMENT '菜单状态: 0-禁用, 1-启用',
                            `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                            `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                            `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                            `is_deleted` tinyint DEFAULT 0 COMMENT '是否删除: 0-否, 1-是',
                            PRIMARY KEY (`id`),
                            UNIQUE KEY `uk_menu_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜单权限表';

-- ----------------------------
-- 5. 字典类型表
-- ----------------------------
CREATE TABLE `sys_dict_type` (
                                 `id` varchar(36) NOT NULL COMMENT '主键UUID',
                                 `name` varchar(50) NOT NULL COMMENT '字典名称',
                                 `code` varchar(50) NOT NULL COMMENT '字典类型编码',
                                 `status` tinyint DEFAULT 1 COMMENT '状态: 0-禁用, 1-启用',
                                 `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                                 `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                                 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                                 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                                 `is_deleted` tinyint DEFAULT 0 COMMENT '是否删除: 0-否, 1-是',
                                 PRIMARY KEY (`id`),
                                 UNIQUE KEY `uk_dict_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='字典类型表';

-- ----------------------------
-- 6. 字典数据表
-- ----------------------------
CREATE TABLE `sys_dict_data` (
                                 `id` varchar(36) NOT NULL COMMENT '主键UUID',
                                 `type_id` varchar(36) NOT NULL COMMENT '字典类型ID',
                                 `label` varchar(50) NOT NULL COMMENT '字典标签',
                                 `value` varchar(100) NOT NULL COMMENT '字典键值',
                                 `sort_order` int DEFAULT 0 COMMENT '排序',
                                 `status` tinyint DEFAULT 1 COMMENT '状态: 0-禁用, 1-启用',
                                 `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                                 `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                                 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                                 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                                 `is_deleted` tinyint DEFAULT 0 COMMENT '是否删除: 0-否, 1-是',
                                 PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='字典数据表';

-- ----------------------------
-- 7. 用户角色关联表 (中间表通常不审计，但按要求统一)
-- ----------------------------
CREATE TABLE `sys_user_role` (
                                 `id` varchar(36) NOT NULL COMMENT '主键UUID',
                                 `user_id` varchar(36) NOT NULL COMMENT '用户ID',
                                 `role_id` varchar(36) NOT NULL COMMENT '角色ID',
                                 `status` tinyint DEFAULT 1 COMMENT '状态',
                                 `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                                 `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                                 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                                 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                                 `is_deleted` tinyint DEFAULT 0 COMMENT '是否删除',
                                 PRIMARY KEY (`id`),
                                 UNIQUE KEY `uk_user_role` (`user_id`,`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户角色关联表';

-- ----------------------------
-- 8. 角色菜单关联表
-- ----------------------------
CREATE TABLE `sys_role_menu` (
                                 `id` varchar(36) NOT NULL COMMENT '主键UUID',
                                 `role_id` varchar(36) NOT NULL COMMENT '角色ID',
                                 `menu_id` varchar(36) NOT NULL COMMENT '菜单ID',
                                 `status` tinyint DEFAULT 1 COMMENT '状态',
                                 `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                                 `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                                 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                                 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                                 `is_deleted` tinyint DEFAULT 0 COMMENT '是否删除',
                                 PRIMARY KEY (`id`),
                                 UNIQUE KEY `uk_role_menu` (`role_id`,`menu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色菜单关联表';

-- ----------------------------
-- 9. 系统日志类表 (登录日志)
-- ----------------------------
CREATE TABLE `sys_login_log` (
                                 `id` varchar(36) NOT NULL COMMENT '主键UUID',
                                 `user_id` varchar(36) DEFAULT NULL COMMENT '用户ID',
                                 `username` varchar(50) NOT NULL COMMENT '用户账号',
                                 `ip` varchar(50) NOT NULL COMMENT '登录地址',
                                 `location` varchar(100) DEFAULT NULL COMMENT '登录地点',
                                 `browser` varchar(50) DEFAULT NULL COMMENT '浏览器类型',
                                 `os` varchar(50) DEFAULT NULL COMMENT '操作系统',
                                 `user_agent` varchar(500) DEFAULT NULL COMMENT '浏览器UA',
                                 `login_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
                                 `status` tinyint NOT NULL COMMENT '状态: 0-失败, 1-成功',
                                 `remark` varchar(255) DEFAULT NULL COMMENT '详细描述/失败原因',
                                 `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                                 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                                 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                                 `is_deleted` tinyint DEFAULT 0 COMMENT '是否删除',
                                 PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统登录日志';

-- ----------------------------
-- 10. 系统运行日志表
-- ----------------------------
CREATE TABLE `sys_system_log` (
                                  `id` varchar(36) NOT NULL COMMENT '主键UUID',
                                  `level` tinyint NOT NULL DEFAULT 0 COMMENT '日志等级: 0-info, 1-warn, 2-error, 3-fatal',
                                  `module` varchar(50) DEFAULT NULL COMMENT '所属模块',
                                  `message` text NOT NULL COMMENT '日志详细信息',
                                  `trace` text DEFAULT NULL COMMENT '异常堆栈信息',
                                  `status` tinyint DEFAULT 1 COMMENT '状态: 0-无效, 1-有效',
                                  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                                  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                                  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
                                  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                                  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                                  `is_deleted` tinyint DEFAULT 0 COMMENT '是否删除: 0-否, 1-是',
                                  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统运行日志表';
SET FOREIGN_KEY_CHECKS = 1;


-- 用户表索引：优化登录和部门查询
CREATE INDEX `idx_user_phone` ON `sys_user` (`phone`);
