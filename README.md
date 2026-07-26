# xxdl-nuxt-admin
建议node: 22.20.2
前端来源: https://soybeanjs.cn/

一个基于 Nuxt 4 的全栈后台管理系统。项目把管理端界面、登录认证、RBAC 权限、系统管理 API 和 MySQL 数据访问放在同一个 Nuxt 应用里，适合作为中后台系统、管理平台或业务后台的基础模板。

## 系统做了什么

- 提供后台管理系统的基础框架：登录、会话、布局、菜单、标签页、面包屑、主题配置和国际化。
- 提供 RBAC 权限能力：用户、角色、菜单、用户角色、角色菜单、按钮权限和路由权限控制。
- 提供常见系统管理模块：用户管理、角色管理、菜单管理、部门管理、字典管理、登录日志、系统日志、OSS 配置和文件管理。
- 提供仪表盘页面：统计卡片、折线图、饼图、项目动态等后台首页内容。
- 提供类型安全的前后端调用：前端通过 tRPC 调用服务端路由，共享 Zod DTO 和 TypeScript 类型。
- 提供数据库访问层：使用 Drizzle ORM 连接 MySQL，维护系统表结构和通用查询能力。

## 支持什么

- 单体全栈后台：前端页面和服务端 API 共用一个 Nuxt 项目。
- 用户名密码登录和服务端会话。
- 基于角色和菜单的权限控制。
- 中英文国际化。
- 明暗主题、主题色、布局模式、圆角、水印等界面配置。
- 表格分页、搜索、批量操作、列设置和常见 CRUD 页面。
- OSS 配置校验和文件上传管理。
- Vitest 测试、Nuxt 类型检查和 Drizzle 数据库同步。

## 用了什么

- Nuxt 4 / Vue 3 / TypeScript
- Nuxt UI 4 / Tailwind CSS 4
- Pinia / Vue Router
- tRPC / trpc-nuxt
- Zod
- Drizzle ORM / MySQL
- nuxt-auth-utils
- nuxt-i18n-micro
- nuxt-echarts
- Vitest

## 常用命令

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
pnpm typecheck
pnpm test
pnpm db:push
pnpm db:pull
pnpm seed:admin
```

## GitHub 描述

中文：

基于 Nuxt 4、Nuxt UI、tRPC、Drizzle ORM 和 MySQL 的全栈后台管理系统，内置登录认证、RBAC 权限、用户/角色/菜单/部门/字典/日志/OSS 管理、国际化和主题配置。

English:

A full-stack Nuxt 4 admin system built with Nuxt UI, tRPC, Drizzle ORM, and MySQL, featuring authentication, RBAC permissions, user/role/menu/department/dictionary/log/OSS management, i18n, and theme customization.
