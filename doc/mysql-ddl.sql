-- nuxt_copy_admin.demo definition

CREATE TABLE `demo` (
                        `id` varchar(36) NOT NULL COMMENT '主键',
                        `status` tinyint DEFAULT '1' COMMENT '状态: 0-无效, 1-有效',
                        `remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注',
                        `created_by` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '创建人ID',
                        `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
                        `updated_by` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '更新人ID',
                        `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                        `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
                        `field1` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
                        `field2` varchar(100) DEFAULT NULL,
                        PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='演示表';


-- nuxt_copy_admin.sys_department definition

CREATE TABLE `sys_department` (
                                  `id` varchar(36) NOT NULL COMMENT '主键UUID',
                                  `name` varchar(50) NOT NULL COMMENT '部门名称',
                                  `code` varchar(50) NOT NULL COMMENT '部门编码',
                                  `parent_id` varchar(36) DEFAULT NULL COMMENT '父部门ID',
                                  `path` varchar(255) DEFAULT NULL COMMENT '层级路径',
                                  `level` int DEFAULT '0' COMMENT '部门层级',
                                  `sort_order` int DEFAULT '0' COMMENT '显示排序',
                                  `leader` varchar(50) DEFAULT NULL COMMENT '负责人',
                                  `phone` varchar(20) DEFAULT NULL COMMENT '联系电话',
                                  `email` varchar(100) DEFAULT NULL COMMENT '联系邮箱',
                                  `status` tinyint DEFAULT '1' COMMENT '状态: 0-禁用, 1-启用',
                                  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                                  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                                  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                                  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                                  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
                                  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='部门管理表';


-- nuxt_copy_admin.sys_dict_data definition

CREATE TABLE `sys_dict_data` (
                                 `id` varchar(36) NOT NULL COMMENT '主键UUID',
                                 `type_id` varchar(36) NOT NULL COMMENT '字典类型ID',
                                 `label` varchar(50) NOT NULL COMMENT '字典标签',
                                 `value` varchar(100) NOT NULL COMMENT '字典键值',
                                 `sort_order` int DEFAULT '0' COMMENT '排序',
                                 `status` tinyint DEFAULT '1' COMMENT '状态: 0-禁用, 1-启用',
                                 `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                                 `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                                 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                                 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                                 `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
                                 PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='字典数据表';


-- nuxt_copy_admin.sys_dict_type definition

CREATE TABLE `sys_dict_type` (
                                 `id` varchar(36) NOT NULL COMMENT '主键UUID',
                                 `name` varchar(50) NOT NULL COMMENT '字典名称',
                                 `code` varchar(50) NOT NULL COMMENT '字典类型编码',
                                 `status` tinyint DEFAULT '1' COMMENT '状态: 0-禁用, 1-启用',
                                 `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                                 `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                                 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                                 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                                 `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
                                 PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='字典类型表';


-- nuxt_copy_admin.sys_login_log definition

CREATE TABLE `sys_login_log` (
                                 `id` varchar(36) NOT NULL COMMENT '主键UUID',
                                 `user_id` varchar(36) DEFAULT NULL COMMENT '用户ID',
                                 `username` varchar(50) NOT NULL COMMENT '用户账号',
                                 `ip` varchar(50) NOT NULL COMMENT '登录地址',
                                 `location` varchar(100) DEFAULT NULL COMMENT '登录地点',
                                 `browser` varchar(50) DEFAULT NULL COMMENT '浏览器类型',
                                 `os` varchar(50) DEFAULT NULL COMMENT '操作系统',
                                 `user_agent` varchar(500) DEFAULT NULL COMMENT '浏览器UA',
                                 `login_type` varchar(30) DEFAULT NULL COMMENT '登录方式 password/code/oauth',
                                 `login_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
                                 `status` tinyint NOT NULL COMMENT '状态: 0-失败, 1-成功',
                                 `remark` varchar(255) DEFAULT NULL COMMENT '详细描述/失败原因',
                                 `error_code` varchar(80) DEFAULT NULL COMMENT '失败错误码',
                                 `trace_id` varchar(64) DEFAULT NULL COMMENT '链路追踪ID',
                                 `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                                 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                                 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                                 `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除',
                                 PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系统登录日志';


-- nuxt_copy_admin.sys_menu definition

CREATE TABLE `sys_menu` (
                            `id` varchar(36) NOT NULL COMMENT '主键UUID',
                            `parent_id` varchar(36) DEFAULT NULL COMMENT '父菜单ID',
                            `name` varchar(50) NOT NULL COMMENT '菜单名称',
                            `code` varchar(50) NOT NULL COMMENT '权限标识',
                            `type` tinyint NOT NULL COMMENT '菜单类型: 0-目录, 1-菜单, 2-按钮',
                            `path` varchar(255) DEFAULT NULL COMMENT '路由地址',
                            `component` varchar(255) DEFAULT NULL COMMENT '组件路径',
                            `icon` varchar(50) DEFAULT NULL COMMENT '菜单图标',
                            `sort_order` int DEFAULT '0' COMMENT '显示顺序',
                            `visible` tinyint DEFAULT '1' COMMENT '显示状态: 0-隐藏, 1-显示',
                            `status` tinyint DEFAULT '1' COMMENT '菜单状态: 0-禁用, 1-启用',
                            `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                            `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                            `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                            `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
                            PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='菜单权限表';


-- nuxt_copy_admin.sys_notice definition

CREATE TABLE `sys_notice` (
                              `id` varchar(36) NOT NULL COMMENT '主键ID',
                              `title` varchar(200) NOT NULL COMMENT '公告标题',
                              `summary` varchar(500) DEFAULT NULL COMMENT '公告摘要',
                              `content` longtext COMMENT '公告内容',
                              `content_format` varchar(20) NOT NULL DEFAULT 'html' COMMENT '内容格式：html/md',
                              `notice_type` tinyint NOT NULL DEFAULT '1' COMMENT '公告类型：1通知 2公告',
                              `top_flag` tinyint NOT NULL DEFAULT '0' COMMENT '是否置顶：0否 1是',
                              `publish_status` tinyint NOT NULL DEFAULT '1' COMMENT '发布状态：1已发布 2草稿',
                              `publish_time` timestamp NULL DEFAULT NULL COMMENT '发布时间',
                              `sort_order` int DEFAULT '0' COMMENT '排序',
                              `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                              `created_by` varchar(36) DEFAULT NULL COMMENT '创建人',
                              `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                              `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人',
                              `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                              `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除：0否 1是',
                              PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='通知公告表';


-- nuxt_copy_admin.sys_oss definition

CREATE TABLE `sys_oss` (
                           `id` varchar(36) NOT NULL COMMENT '主键UUID',
                           `config_id` varchar(36) DEFAULT NULL COMMENT 'OSS配置ID',
                           `file_name` varchar(255) NOT NULL COMMENT '存储文件名',
                           `original_name` varchar(255) NOT NULL COMMENT '原始文件名',
                           `file_suffix` varchar(50) DEFAULT NULL COMMENT '文件后缀',
                           `file_size` bigint DEFAULT '0' COMMENT '文件大小，单位字节',
                           `content_type` varchar(100) DEFAULT NULL COMMENT '文件MIME类型',
                           `bucket_name` varchar(100) DEFAULT NULL COMMENT '存储桶名称',
                           `object_name` varchar(500) NOT NULL COMMENT '对象存储路径',
                           `url` varchar(1000) NOT NULL COMMENT '文件访问地址',
                           `md5` varchar(64) DEFAULT NULL COMMENT '文件MD5',
                           `etag` varchar(255) DEFAULT NULL COMMENT '对象存储ETag',
                           `service` varchar(50) NOT NULL COMMENT '存储服务类型：local/minio/aliyun/tencent/qiniu',
                           `upload_user_id` varchar(36) DEFAULT NULL COMMENT '上传用户ID',
                           `status` tinyint DEFAULT '1' COMMENT '状态：0-禁用，1-正常',
                           `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                           `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                           `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                           `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                           `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                           `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除：0-否，1-是',
                           PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='文件管理表';


-- nuxt_copy_admin.sys_oss_config definition

CREATE TABLE `sys_oss_config` (
                                  `id` varchar(36) NOT NULL COMMENT '主键UUID',
                                  `config_key` varchar(100) NOT NULL COMMENT '配置标识',
                                  `config_name` varchar(100) NOT NULL COMMENT '配置名称',
                                  `service` varchar(50) NOT NULL COMMENT '存储服务类型：local/minio/aliyun/tencent/qiniu',
                                  `endpoint` varchar(255) DEFAULT NULL COMMENT '访问端点',
                                  `region` varchar(100) DEFAULT NULL COMMENT '区域',
                                  `bucket_name` varchar(100) DEFAULT NULL COMMENT '存储桶名称',
                                  `access_key` varchar(255) DEFAULT NULL COMMENT 'AccessKey',
                                  `secret_key` varchar(500) DEFAULT NULL COMMENT 'SecretKey，建议加密存储',
                                  `domain` varchar(255) DEFAULT NULL COMMENT '自定义访问域名',
                                  `prefix` varchar(255) DEFAULT NULL COMMENT '文件路径前缀',
                                  `is_https` tinyint DEFAULT '1' COMMENT '是否HTTPS：0-否，1-是',
                                  `access_policy` tinyint DEFAULT '1' COMMENT '访问策略：0-私有，1-公共读',
                                  `is_default` tinyint DEFAULT '0' COMMENT '是否默认配置：0-否，1-是',
                                  `verify_status` tinyint DEFAULT '0' COMMENT '验证状态：0-未验证，1-已验证，2-验证失败',
                                  `verify_time` timestamp NULL DEFAULT NULL COMMENT '验证时间',
                                  `verify_message` varchar(500) DEFAULT NULL COMMENT '验证信息',
                                  `status` tinyint DEFAULT '1' COMMENT '状态：0-禁用，1-启用',
                                  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                                  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                                  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                                  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                                  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除：0-否，1-是',
                                  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='文件存储配置表';


-- nuxt_copy_admin.sys_role definition

CREATE TABLE `sys_role` (
                            `id` varchar(36) NOT NULL COMMENT '主键UUID',
                            `name` varchar(50) NOT NULL COMMENT '角色名称',
                            `code` varchar(50) NOT NULL COMMENT '角色权限字符串',
                            `data_scope` varchar(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '数据范围（1：全部数据权限 2：自定数据权限 3：本部门数据权限 4：本部门及以下数据权限 5：仅本人数据权限 6：部门及以下或本人数据权限）',
                            `description` text COMMENT '描述',
                            `is_system` tinyint DEFAULT '0' COMMENT '是否系统内置: 0-否, 1-是',
                            `sort_order` int DEFAULT '0' COMMENT '显示顺序',
                            `status` tinyint DEFAULT '1' COMMENT '角色状态: 0-禁用, 1-启用',
                            `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                            `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                            `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                            `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
                            PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色信息表';


-- nuxt_copy_admin.sys_role_menu definition

CREATE TABLE `sys_role_menu` (
                                 `id` varchar(36) NOT NULL COMMENT '主键UUID',
                                 `role_id` varchar(36) NOT NULL COMMENT '角色ID',
                                 `menu_id` varchar(36) NOT NULL COMMENT '菜单ID',
                                 `status` tinyint DEFAULT '1' COMMENT '状态',
                                 `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                                 `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                                 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                                 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                                 `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除',
                                 PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色菜单关联表';


-- nuxt_copy_admin.sys_system_log definition

CREATE TABLE `sys_system_log` (
                                  `id` varchar(36) NOT NULL COMMENT '主键UUID',
                                  `user_id` varchar(36) DEFAULT NULL COMMENT '操作用户ID',
                                  `username` varchar(50) DEFAULT NULL COMMENT '操作用户名',
                                  `ip` varchar(50) DEFAULT NULL COMMENT '请求IP',
                                  `user_agent` varchar(500) DEFAULT NULL COMMENT 'User-Agent',
                                  `browser` varchar(50) DEFAULT NULL COMMENT '浏览器',
                                  `os` varchar(50) DEFAULT NULL COMMENT '操作系统',
                                  `request_method` varchar(20) DEFAULT NULL COMMENT '请求方法',
                                  `request_path` varchar(255) DEFAULT NULL COMMENT '请求路径',
                                  `trpc_type` varchar(20) DEFAULT NULL COMMENT 'tRPC类型 query/mutation/subscription',
                                  `trpc_path` varchar(150) DEFAULT NULL COMMENT 'tRPC路径',
                                  `duration_ms` int DEFAULT NULL COMMENT '执行耗时毫秒',
                                  `request_params` json DEFAULT NULL COMMENT '请求参数',
                                  `error_code` varchar(80) DEFAULT NULL COMMENT '错误码',
                                  `trace_id` varchar(64) DEFAULT NULL COMMENT '链路追踪ID',
                                  `level` tinyint NOT NULL DEFAULT '0' COMMENT '日志等级: 0-info, 1-warn, 2-error, 3-fatal',
                                  `module` varchar(50) DEFAULT NULL COMMENT '所属模块',
                                  `message` text NOT NULL COMMENT '日志详细信息',
                                  `trace` text COMMENT '异常堆栈信息',
                                  `status` tinyint DEFAULT '1' COMMENT '状态: 0-无效, 1-有效',
                                  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                                  `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                                  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
                                  `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                                  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                                  `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
                                  `request_result` json DEFAULT NULL COMMENT '响应结果',
                                  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系统运行日志表';


-- nuxt_copy_admin.sys_user definition

CREATE TABLE `sys_user` (
                            `id` varchar(36) NOT NULL COMMENT '主键UUID',
                            `username` varchar(50) NOT NULL COMMENT '登录账号',
                            `password` varchar(255) NOT NULL COMMENT '登录密码',
                            `email` varchar(100) NOT NULL COMMENT '用户邮箱',
                            `nickname` varchar(50) DEFAULT NULL COMMENT '用户昵称',
                            `avatar` varchar(255) DEFAULT NULL COMMENT '用户头像',
                            `phone` varchar(20) DEFAULT NULL COMMENT '手机号码',
                            `gender` tinyint DEFAULT '0' COMMENT '性别: 0-未知, 1-男, 2-女',
                            `dept_id` varchar(36) DEFAULT NULL COMMENT '部门ID',
                            `is_admin` tinyint DEFAULT '0' COMMENT '是否管理员: 0-否, 1-是',
                            `last_login_time` timestamp NULL DEFAULT NULL COMMENT '最后登录时间',
                            `last_login_ip` varchar(50) DEFAULT NULL COMMENT '最后登录IP',
                            `status` tinyint DEFAULT '1' COMMENT '帐号状态:  1-启用, 2-禁用',
                            `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                            `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                            `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                            `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
                            PRIMARY KEY (`id`),
                            UNIQUE KEY `uk_user_email` (`email`),
                            KEY `idx_user_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户信息表';


-- nuxt_copy_admin.sys_user_role definition

CREATE TABLE `sys_user_role` (
                                 `id` varchar(36) NOT NULL COMMENT '主键UUID',
                                 `user_id` varchar(36) NOT NULL COMMENT '用户ID',
                                 `role_id` varchar(36) NOT NULL COMMENT '角色ID',
                                 `status` tinyint DEFAULT '1' COMMENT '状态',
                                 `remark` varchar(255) DEFAULT NULL COMMENT '备注',
                                 `created_by` varchar(36) DEFAULT NULL COMMENT '创建人ID',
                                 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 `updated_by` varchar(36) DEFAULT NULL COMMENT '更新人ID',
                                 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                                 `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除',
                                 PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户角色关联表';


-- nuxt_copy_admin.system_demo definition

CREATE TABLE `system_demo` (
                               `id` varchar(36) NOT NULL COMMENT '主键',
                               `status` tinyint DEFAULT '1' COMMENT '状态: 0-无效, 1-有效',
                               `remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注',
                               `created_by` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '创建人ID',
                               `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
                               `updated_by` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '更新人ID',
                               `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                               `is_deleted` tinyint DEFAULT '0' COMMENT '是否删除: 0-否, 1-是',
                               `field1` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
                               `field2` varchar(100) DEFAULT NULL,
                               `myname` varchar(100) DEFAULT NULL,
                               PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='演示表2';