# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概述

项目详细信息请参考 README.md。本文档专注于 README.md 中未涵盖的架构细节和核心实现机制。

## 环境配置

通过 `nuxt.config.ts` 的 `runtimeConfig` 暴露环境变量:
- `runtimeConfig.db.*` - 数据库连接配置(服务端)
- `runtimeConfig.public.appName` - 客户端可访问的应用名称

## CommonRepo 工厂模式

`server/drizzle/CommonRepo.ts` 提供通用 CRUD 操作,避免重复代码:

```ts
// 创建 Repo
export const sysUserRepo = CommonRepo(sysUser, SysUserBaseSchema)

// 自动获得以下方法:
repo.list(dto)           // 查询列表
repo.page(page, pageSize, dto)  // 分页查询
repo.getOne(req)          // 单条件查询
repo.getById(id)          // 根据 ID 查询
repo.create(data)          // 新增
repo.updateById(id, data)  // 更新
repo.remove(id)           // 逻辑删除(isDeleted=1)
```

**特性**:
- 自动处理软删除(`buildScope` 添加 `isDeleted=0`)
- 自动构建查询条件(`buildWhereBySchema` 根据传入的 DTO 构建 WHERE)
- 自动合并查询条件(`mergeWhere` 合并 scope 和动态条件)

## 测试规范

测试使用 `createCallerFactory` 直接调用 tRPC 路由,不经过 HTTP 请求:

```ts
import { appRouter, type AppRouter } from '#server/trpc/routers'
import { createCallerFactory } from '#server/trpc/init'
import { createTestDb } from '#server/drizzle/db'
import type { Context } from '#server/trpc/context'

const createCaller = (ctx: Context) => createCallerFactory<AppRouter>(appRouter)(ctx)

describe('测试示例', () => {
  let caller: Caller

  // 每个测试前创建新的 context 和 caller
  beforeEach(async () => {
    const ctx = { db: createTestDb(), event: {} as any }
    caller = createCaller(ctx)
  })

  it('测试路由', async () => {
    const result = await caller.sysUser.test()
    expect(result).toBe('hello word')
  })
})
```

**注意事项**:
- 使用 `createTestDb()` 创建测试数据库连接,不依赖 Nuxt 运行时
- 使用 `beforeEach` 确保每个测试独立性
- 测试数据使用 `randomUuid()` 生成唯一 ID

## tRPC 层架构

tRPC 在该项目中是前后端通信的核心,提供端到端类型安全:

### 初始化 (`server/trpc/init.ts`)
- `initTRPC.context<Context>().create()` - 创建 tRPC 实例
- `publicProcedure` - 公开 procedure(无需认证)
- `protectedProcedure` - 需要认证的 procedure(包含 logger + auth 中间件)
- `customProcedure` - 自定义验证 middleware

### 上下文 (`server/trpc/context.ts`)
- `createContext(event: H3Event)` - 为每个请求创建上下文
- 上下文包含 `db` 和 `event`,用于访问数据库和请求/响应

### 路由收集 (`server/trpc/routers.ts`)
- `appRouter` - 聚合所有业务路由
- 各业务模块路由位于 `server/sys-router/*/index.ts`
- 导出 `AppRouter` 类型供客户端使用

### API 端点 (`server/api/trpc/[trpc].ts`)
- 使用 `trpc-nuxt/server` 的 `createTRPCNuxtHandler`
- 端点: `/api/trpc`
- 自动处理 tRPC 请求解析和响应

### 错误处理 (`server/trpc/errorFormatter.ts`)
- 统一的 Zod 错误格式化
- 优先返回字段错误,其次表单错误,最后回退到通用错误
- 生产环境隐藏堆栈信息

## 客户端 tRPC 配置

客户端插件 (`app/plugins/01.client.ts`):

- **重试机制**: 仅对 500 错误的 query 重试 1 次,延迟指数递增
- **错误处理**: 捕获 tRPC 错误,解析错误详情并通过 Toast 显示
- **批量请求**: 使用 `httpBatchLink` 合并多个请求
- **凭证传递**: `credentials: 'include'` 支持 cookie
- **使用方式**: `$trpc.sysUser.test.mutate()`

## 数据库层

- **Schema 定义**: `server/drizzle/schema/` - 所有数据库表结构
- **DB 实例**: `server/drizzle/db.ts` - 使用连接池的 Drizzle 实例
- **通用 Repo**: `server/drizzle/CommonRepo.ts` - CRUD 基础逻辑工厂
- **查询构建**: `server/drizzle/queries/` - WHERE 条件、scope 等构建工具
- **数据库配置**: 通过 `drizzle.config.ts` 从环境变量读取

## 查询构建工具

`server/drizzle/queries/` 目录下有三个核心工具:

1. **buildWhereBySchema**: 根据传入的 DTO 和 Zod Schema 构建 WHERE 条件
2. **mergeWhere**: 合并多个 WHERE 条件(如软删除 scope 和动态查询条件)
3. **buildScope**: 构建软删除 scope(自动添加 `isDeleted=0`)

这些工具让 `CommonRepo` 能够自动处理复杂的查询逻辑。

## 错误处理

tRPC 后端路由应抛出 **400 错误**,因为 500 错误会触发客户端自动重试机制。

错误格式化在 `server/trpc/errorFormatter.ts` 中处理:
- Zod 验证错误会被格式化为友好的错误消息
- 优先返回字段错误(如 `username: 用户名至少3个字符`)
- 生产环境隐藏堆栈信息

## 数据库表结构

系统包含以下核心表(位于 `server/drizzle/schema/`):

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

所有表都包含标准的审计字段: `createdBy`, `createdAt`, `updatedBy`, `updatedAt`, `isDeleted`。

## 分页响应类型

`server/utils/ApiResp.ts` 定义了 ORM 分页响应类型:

```ts
export type OrmPageResp = {
    total: number,
    page: number,
    pageSize: number,
    list: any[]
}
```

这是 `CommonRepo.page()` 的返回类型,Service 层直接使用此类型。
