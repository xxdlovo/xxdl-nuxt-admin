# NuxtAdmin

[English](README.md) | [简体中文](README.zh-CN.md)

A full-stack Nuxt 4 admin system built with Nuxt UI, tRPC, Drizzle ORM, and MySQL.

NuxtAdmin is designed as a practical foundation for internal tools, business management platforms, and backend administration systems. It puts the admin interface, authentication, RBAC permissions, system modules, typed APIs, and database access in one Nuxt application.

> Recommended Node.js version: `22.20.2`

## Demo

- Demo address 1: https://nuxtadmin.devitem.top/
- Demo address 2: https://xxdl-nuxt-admin.vercel.app/
- Account: `admin`
- Password: `adminadmin`

The demo environment is read-only for destructive business operations. Editing and deleting data will return: `Operation not allowed in demo environment`.

## Preview

![Dashboard](public/images/dashboard.png)

![User management](public/images/users_manager.png)

![Role management](public/images/role_manager.png)

![Menu management](public/images/menu_list.png)

## Features

- Full-stack Nuxt application with frontend pages and server APIs in one project.
- Username/password authentication and server-side sessions.
- Protected routes for authenticated backend pages.
- RBAC permission model for users, roles, menus, routes, data scopes, and button permissions.
- User, role, menu, department, dictionary, notice, OSS, log, and scheduled job management.
- Dashboard page with statistics, charts, notices, activity, and shortcuts.
- Type-safe API calls through tRPC.
- Shared DTO validation with Zod.
- MySQL database access through Drizzle ORM.
- Multilingual support.
- Light/dark mode and configurable themes.
- Table pagination, search, batch actions, column settings, and common CRUD workflows.
- Demo environment protection for edit/delete operations.
- Code generation workflow for quickly adding new business modules.

## Tech Stack

- Nuxt 4
- Vue 3
- TypeScript
- Nuxt UI 4
- Tailwind CSS 4
- Pinia
- Vue Router
- tRPC / trpc-nuxt
- Zod
- Drizzle ORM
- MySQL
- nuxt-auth-utils
- nuxt-i18n-micro
- nuxt-echarts
- Vitest

## Quick Start

Install dependencies:

```bash
pnpm install
```

Create and initialize the database:

```bash
mysql -u <user> -p <database> < doc/mysql-ddl.sql
mysql -u <user> -p <database> < doc/init-self.sql
```

Start the development server:

```bash
pnpm dev
```

Configure database and session values in `.env` before starting the project. See `.env.example` for the available environment variables.

## Common Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
pnpm typecheck
pnpm test
pnpm db:push
pnpm db:pull
```

Database initialization scripts:

```bash
mysql -u <user> -p <database> < doc/mysql-ddl.sql
mysql -u <user> -p <database> < doc/init-self.sql
```

## Code Generation

The project includes a module generation guide: [doc/code-gen.md](doc/code-gen.md).

Use it when adding a new business module after the database table has been created. A typical prompt is:

```text
我已建好 <table_name> 表，模块名 <module>，业务名 <BusinessName>，请根据 doc/code-gen.md 帮我生成代码。
```

Examples:

```text
我已建好 demo 表，模块名 demo，业务名 Demo，请根据 doc/code-gen.md 帮我生成代码。
```

```text
我已建好 sys_user 表，模块名 system/user，业务名 SysUser，请根据 doc/code-gen.md 帮我生成代码。
```

The guide covers Drizzle schema generation, shared Zod DTOs, repository/service/router files, tRPC registration, frontend pages, search forms, operation modals, i18n keys, and RBAC permission codes.

## Directory Structure

Only representative files are shown below. Repeated system modules follow the same pattern.

```text
.
|-- app/
|   |-- components/
|   |   |-- table/
|   |   `-- u/
|   |-- composables/
|   |-- layouts/
|   |   `-- modules/
|   |-- locales/
|   |   |-- en.json
|   |   `-- zh.json
|   |-- pages/
|   |   |-- demo/
|   |   |   |-- components/
|   |   |   `-- index.vue
|   |   |-- landing/
|   |   `-- system/
|   |       |-- user/
|   |       |-- role/
|   |       |-- menu/
|   |       `-- job/
|   `-- app.vue
|-- server/
|   |-- api/
|   |-- demo-router/
|   |-- drizzle/
|   |   |-- schema/
|   |   |   |-- demo/
|   |   |   `-- system/
|   |   |-- CommonRepo.ts
|   |   `-- db.ts
|   |-- sys-router/
|   |   |-- auth/
|   |   |-- user/
|   |   |-- role/
|   |   |-- menu/
|   |   `-- job/
|   |-- tasks/
|   `-- trpc/
|       |-- middlewares/
|       |-- context.ts
|       |-- init.ts
|       `-- routers.ts
|-- shared/
|   |-- auth/
|   |-- constants/
|   |-- demo/
|   |-- system/
|   `-- types/
|-- doc/
|   |-- code-gen.md
|   |-- mysql-ddl.sql
|   `-- init-self.sql
|-- public/
|   `-- images/
|-- nuxt.config.ts
`-- package.json
```

## Scheduled Jobs

The scheduled job module includes:

- `sys_job` and `sys_job_log` database schemas.
- Job list and job-log admin pages.
- Cron expression validation.
- `Asia/Shanghai` timezone support.
- Job status and running status fields.
- Manual "run now" execution.
- Due-job dispatching through Nitro tasks.
- Job handler registration.
- Execution result and error logging.
- Built-in examples such as old-log cleanup and a reserved demo reset handler.

## Reference

- [SoybeanJS](https://soybeanjs.cn/)

## Project Description

A full-stack Nuxt 4 admin system built with Nuxt UI, tRPC, Drizzle ORM, and MySQL, featuring authentication, RBAC permissions, user/role/menu/department/dictionary/log/OSS/job management, multilingual support, theme customization, demo environment protection, and a documented module generation workflow.
