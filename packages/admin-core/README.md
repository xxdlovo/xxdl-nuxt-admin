# xxdl-admin-core

Nuxt 4 后台管理基座层（Nuxt Layer）。提供登录认证、RBAC 权限、系统管理模块、类型安全 API（tRPC）、以及基于 Drizzle ORM 的 MySQL 数据访问。

业务项目通过 `extends` 引入，后台的页面、组件、composable、store、服务端路由全部来自本层，**自己的项目里不会出现后台代码**。

## 特性

- 用户名密码 / 第三方 OAuth 登录，基于 `nuxt-auth-utils` 的服务端 session
- RBAC：用户、角色、菜单、部门、数据范围、按钮级权限码
- 系统模块：用户 / 角色 / 菜单 / 部门 / 字典 / 公告 / 配置 / OSS / 登录日志 / 系统日志 / 定时任务 / OpenAPI 文档
- 端到端类型安全：tRPC + Zod，前后端共享契约（`shared/`）
- 多语言（中 / 英）、明暗主题、可配置布局与主题色
- 定时任务调度、操作日志、请求级宽事件日志（evlog）
- 内置 OpenAPI 文档端点（`/api/openapi.json`、`/api/docs`）

## 安装

```bash
pnpm add -D xxdl-admin-core
```

`nuxt` 是 peer dependency，由业务项目提供。

## 使用

`nuxt.config.ts` 里一行即可：

```ts
export default defineNuxtConfig({
  extends: ['xxdl-admin-core']
})
```

需要电商能力（会员 / 商品 / 订单 / 支付 / 钱包）时改为引入 [`xxdl-admin-trade`](https://www.npmjs.com/package/xxdl-admin-trade)，它会自动带上本层。

## 环境变量

至少需要以下几项（`.env`）：

```dotenv
# 数据库：推荐用一行连接串
DATABASE_URL=mysql://root:password@127.0.0.1:3306/nuxt_admin

# 也可以改用分字段配置（DATABASE_URL 未设置时生效）
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=nuxt_admin
# DB_USER=root
# DB_PASSWORD=

# Session 密钥，必须是 32 位以上随机字符串
NUXT_SESSION_PASSWORD=please-change-to-a-random-32-char-secret

# 可选：演示模式（禁止所有新增/修改/删除）
NUXT_DEMO_MODE=false

# 可选：OpenAPI 端点开关
NUXT_OPENAPI_ENABLED=true

# 可选：支付渠道密钥的 AES 主密钥（仅使用支付功能时需要）
NUXT_PAY_CONFIG_KEY=
```

连接串支持 `mysql://user:pass@host:port/db` 与不带协议前缀的写法，解析逻辑见 `server/drizzle/db.ts`。

## 初始化数据库

### 方式一：直接执行 SQL（推荐）

```bash
mysql -u <user> -p <database> < node_modules/xxdl-admin-core/sql/mysql-ddl.sql
mysql -u <user> -p <database> < node_modules/xxdl-admin-core/sql/init.sql
```

`mysql-ddl.sql` 建表，`init.sql` 写入默认菜单、角色、字典与管理员账号。

默认管理员：`admin / adminadmin`（**部署前请务必修改**）。

### 方式二：drizzle-kit

本层自带 `db:push` 脚本，但需要 `drizzle-kit` 与 `tsx`（本项目将它们列为 devDependencies，业务项目需自行安装）。

## 覆盖与定制

Nuxt Layer 的优先级是 **业务项目 > 业务层 > 基座**。因此：

| 想做的事 | 做法 | 是否脱离基座更新 |
|---|---|---|
| 加一个后台页面 | 在 `app/pages/system/xxx/index.vue` 新建 | 否 |
| 加一个接口 | 在服务端目录新建 router 并在项目里合并 | 否 |
| 改主题色 / Logo | 覆盖 `app/app.config.ts`、替换 `public/` 资源 | 否 |
| 改某张页面的文案或布局 | 覆盖同名 `.vue` 文件 | **是**（此后不再收到该文件的基座更新） |

建议优先"新增"而不是"覆盖"。

## 与业务层共存的注意点

- **插件注入只能有一份**：`provide` 的 key 在多层间不可重复，Nuxt 会在第二次注册时抛 `Cannot redefine property`。业务层扩展请用注册表（本层已提供 `registerSysJobHandlers`、`registerUserOnboardHook`、`registerUserMenuItems`）。
- **依赖要单实例**：`vue`、`pinia`、`@trpc/*` 在多包间必须是同一份物理实例，否则 `getActivePinia()` 之类拿不到状态。业务层请用 `peerDependencies`，并保证 `typescript` 版本一致。
- **包内别名**：本层源码统一使用 `#admin/*` 访问自身文件；`~/`、`@/`、`#server`、`#shared` 在 Layer 中都指向**宿主项目**，不能用于跨层引用。

## 许可

[MIT](./LICENSE)
