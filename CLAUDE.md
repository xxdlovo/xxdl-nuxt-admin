# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 Nuxt 4 的全栈管理系统，使用 tRPC 实现端到端类型安全的 API 调用。项目参考 soybean-admin 进行 UI 设计，包含完整的 RBAC 权限体系（用户、角色、部门、菜单、字典、日志）。

## 技术栈

- **前端**: Nuxt 4 + Nuxt UI (@nuxt/ui v4) + Vue 3
- **后端 API**: Nitro + tRPC
- **数据库**: MySQL + Drizzle ORM
- **国际化**: nuxt-i18n-micro

## 常用命令

```bash
# 开发
npm run dev          # 启动开发服务器

# 构建
npm run build        # 构建生产版本
npm run generate     # 生成静态站点
npm run preview      # 预览生产构建

# 数据库迁移
npx drizzle-kit generate     # 生成数据库迁移文件
npx drizzle-kit push         # 推送 schema 到数据库
npx drizzle-kit studio       # 打开 Drizzle Studio 可视化界面

# 依赖
npm install                  # 安装依赖（使用 pnpm）
npm run postinstall          # Nuxt 预处理
```

## 环境配置

项目使用 `.env` 文件配置环境变量，参考 `.env.example`：

```
DB_HOST=localhost
DB_DATABASE=nuxt_admin
DB_USER=root
DB_PASSWORD=root
SESSION_SECRET=replace-your-random-string
```

配置通过 `nuxt.config.ts` 的 `runtimeConfig` 暴露：
- `runtimeConfig.db.*` - 数据库连接配置（服务端）
- `runtimeConfig.public.appName` - 客户端可访问的应用名称

## 架构概览

### tRPC 层架构

tRPC 在该项目中是前后端通信的核心，提供端到端类型安全：

1. **初始化** (`server/trpc/init.ts`):
   - `initTRPC.context<Context>().create()` - 创建 tRPC 实例
   - `publicProcedure` - 公开 procedure（无需认证）
   - `customProcedure` - 自定义验证 middleware

2. **上下文** (`server/trpc/context.ts`):
   - `createContext(event: H3Event)` - 为每个请求创建上下文
   - 上下文包含 H3Event，用于访问 request/response

3. **路由收集** (`server/trpc/routers.ts`):
   - `appRouter` - 聚合所有业务路由
   - 各业务模块路由位于 `server/sys-router/*/index.ts`
   - 导出 `AppRouter` 类型供客户端使用

4. **API 端点** (`server/api/trpc/[trpc].ts`):
   - 使用 `trpc-nuxt/server` 的 `createTRPCNuxtHandler`
   - 端点: `/api/trpc`
   - 自动处理 tRPC 请求解析和响应

### 客户端 tRPC 配置

客户端插件 (`app/plugins/01.client.ts`):

- **重试机制**: 仅对 500 错误的 query 重试 1 次，延迟指数递增
- **错误处理**: 捕获 tRPC 错误，解析错误详情并通过 Toast 显示
- **批量请求**: 使用 `httpBatchLink` 合并多个请求
- **凭证传递**: `credentials: 'include'` 支持 cookie
- **使用方式**: `$trpc.sysUser.test.mutate()`

### 数据库层

- **Schema 定义**: `server/db/schema.ts` - 所有数据库表结构
- **DB 实例**: `server/db/db.ts` - 使用连接池的 Drizzle 实例
- **数据库配置**: 通过 `drizzle.config.ts` 从环境变量读取

### 目录结构

```
├── app/                    # Nuxt 4 核心逻辑目录 (~ 或 @)
│   ├── app.vue            # 根组件
│   ├── assets/            # 静态资源（CSS、图片、SVG）
│   └── plugins/           # Vue/Nuxt 插件
│
├── server/                 # 后端代码 (#server)
│   ├── api/trpc/[trpc].ts # tRPC API 端点
│   ├── db/                # 数据库配置和 schema
│   │   ├── db.ts         # Drizzle db 实例
│   │   └── schema.ts     # 表结构定义
│   ├── trpc/              # tRPC 初始化和路由
│   │   ├── init.ts       # tRPC 初始化
│   │   ├── context.ts    # 请求上下文
│   │   └── routers.ts    # 路由聚合
│   └── sys-router/        # 业务模块路由
│       └── user/         # 用户相关路由
│
├── shared/                # 前后端共享代码
│   ├── types/            # 共享类型定义
│   └── utils/            # 共享工具函数
│
├── soybean-admin/        # 参考项目（用于样式参考）
├── doc/                  # 项目文档
│   └── mysql_init.sql    # MySQL 初始化脚本
└── nuxt.config.ts        # Nuxt 配置
```

## 开发规范

### 命名约定

- **组件文件**: 大驼峰命名 - `UserProfile.vue`
- **Vue 文件、API 路由、目录**: kebab-case - `pages/user-profile.vue`, `api/user-controller.ts`
- **系统相关**: 使用 `system` 或 `sys` 前缀 - `sysUser`, `sys-router`

### 共享代码规范

`shared/` 目录中的工具类和类型定义必须**显式导入**，避免自动导入导致代码追踪困难。

### tRPC 路由开发

创建新的业务路由：

1. 在 `server/sys-router/模块名/` 创建 `index.ts`
2. 使用 `router()` 和 `publicProcedure` 定义 procedures
3. 在 `server/trpc/routers.ts` 中导入并注册到 `appRouter`

```ts
// server/sys-router/example/index.ts
import { publicProcedure, router } from '~~/server/trpc/init'
import type { Context } from '~~/server/trpc/context'

export const exampleRouter = router({
  test: publicProcedure.mutation(async ({ ctx }: { ctx: Context }) => {
    return 'hello world'
  }),
})
```

```ts
// server/trpc/routers.ts
export const appRouter = router({
  sysUser: sysUserRouter,
  example: exampleRouter,  // 注册新路由
})
```

### 数据库 schema 开发

1. 在 `server/db/schema.ts` 使用 `mysqlTable` 定义表结构
2. 使用 `primaryKey()`, `unique()`, `index()` 添加约束
3. 运行 `npx drizzle-kit generate` 生成迁移
4. 运行 `npx drizzle-kit push` 推送到数据库

### 路径别名

- `~` 或 `@` → `app/` (Nuxt 4 核心目录)
- `#server` → `server/` (Nuxt 服务端目录)
- `~~` 或 `@@` → 项目根目录

### 错误处理

tRPC 后端路由应抛出 **400 错误**，因为 500 错误会触发客户端自动重试机制。

客户端错误处理在 `app/plugins/01.client.ts` 中自动捕获并通过 Toast 显示。

## 数据库表结构

系统包含以下核心表（位于 `server/db/schema.ts`）：

- `sysUser` - 用户表
- `sysRole` - 角色表
- `sysUserRole` - 用户角色关联表
- `sysDepartment` - 部门表
- `sysMenu` - 菜单表
- `sysRoleMenu` - 角色菜单关联表
- `sysDictType` - 字典类型表
- `sysDictData` - 字典数据表
- `sysLoginLog` - 登录日志表
- `sysSystemLog` - 系统日志表

所有表都包含标准的审计字段：`createdBy`, `createdAt`, `updatedBy`, `updatedAt`, `isDeleted`。
