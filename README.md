# 说明
本项目是一个nuxt全栈项目, 技术栈包含nuxt/nuxt ui/drizzleorm等, 目的是通过soybean-admin项目进行参考, 创建一个类似的nuxt项目.
- **前端代码**： Nuxt 4 项目结构，使用 Nuxt UI（基于 Radix UI + Headless UI + Tailwind CSS），包含页面、组件、布局、composables 等
- **后端代码**：使用 Nitro + tRPC 实现 API 服务（server/*），集成 nuxt-auth-utils 认证中间件、RBAC 权限校验、端到端类型安全
- **数据库**： 优先适配MySQL 数据库（用户、角色、部门、菜单、字典、日志等），使用 Drizzle ORM 进行类型安全的数据库访问

## 目标
首要目标是快速迭代出一个可运行/可部署的全栈管理系统, 后续进行进一步的优化和扩展.
**Goals:**
- 构建基于 Nuxt 4 的全栈管理系统（前端 + 后端 API 统一在 Nuxt 项目中）
- 实现完整的 RBAC 权限体系（用户、角色、部门、菜单、字典、日志）
- 使用 tRPC 实现端到端类型安全的 API 调用
- 提供参考 soybean-admin 的清新优雅 UI 设计
- 支持国际化（中英文）和主题切换（亮色/暗色）
- 实现可扩展的数据库架构（使用 Drizzle ORM）
- 提供完整的日志管理和仪表盘统计

**Non-Goals:**
- 不实现复杂的权限继承规则（仅使用基于角色的直接授权）
- 不实现多租户支持（单系统单租户）
- 不实现第三方登录集成（仅用户名密码登录）
- 不实现工作流引擎（仅基础的 CRUD 操作）
- 不实现报表生成器（仅基础导出功能）

## 后端流程
目录说明:
```pgsql
drizzle: 放通用查询,构建参数, 初始化db, pull,push schema
drizzle\schema: 放导出后的 schema
drizzle\db.ts: 数据库连接
drizzle\drizzle.config.ts: drizzle orm的pull/push配置
sys-router: 系统相关的路由, 按功能模块划分
    user: 用户管理
    role: 角色管理
    ...

```
## 目录说明
```pgsql
/soybean-admin: 开源项目的代码, 用来参考样式实现. 让ai能访问
/server/trpc: 初始化trpc, 收集router
/server/sys-router: 系统相关的路由
/pages/system: 后台管理相关的界面

```

## 开发规范
### 命名
* 组件文件名采用大驼峰命名,如 UserProfile.vue
* schema, dto采用大驼峰命名, 如 SysUserBaseSchema
* vue文件, api路由, 目录名采用kebab-case, 如 pages/user-profile.vue, api/user-controller.ts
* server中的数据库实体采用小驼峰命名, 如 sysUser, sysLog. 
* server中采用三层架构, 默认为index,service, repo. 命名时添加前缀, 如 SysUserService, SysUserRepo
* shared中按照功能模块创建目录, 如 shared/system/user目录放系统用户相关的类
* shared中的实体命名采用大驼峰, 按照实体名+动词+Dto, 比如SysUserUpdatePwdDTO,SysUserAddDto
* 每个实体类下有个common.ts, 放通用的属性, 注意:
  通过该实体的drizzle orm的schema生成, 非空情况和schema一致. 比如
  id在schema中定义为notNull, 在common中也不能加nullish()
  其余不确定的, 要在common中加nullish()
### 开发规则
shared中的工具类, 类型定义都要显式导入, 避免后续找不到代码.
系统相关的东西用system或sys标明
后端逻辑:
后端repo/dao层返回drizzleorm的类型, 由orm自动生成, 存放在server/drizzle/schema下面
后端server层返回Dto类, 存放在shared/功能模块,目录下
后端router(controller)层只做调用, 不处理数据


## 常用命令
~~ 或 @@,项目根目录,包含 nuxt.config.ts、package.json 的最外层目录。
~ 或 @,app/ 目录,Nuxt 4 的核心逻辑目录。
#server 根目录下的server目录

