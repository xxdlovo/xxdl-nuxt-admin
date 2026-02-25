# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nuxt 4 full-stack admin system with tRPC for type-safe APIs, Drizzle ORM for MySQL, and RBAC permission system. Inspired by soybean-admin for UI design.

**Tech Stack**: Nuxt 4, Nuxt UI (Radix UI + Headless UI + Tailwind CSS), Nitro + tRPC, Drizzle ORM, Zod, nuxt-auth-utils

## Development Commands

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm generate     # Generate static site
pnpm preview      # Preview production build
pnpm db:push      # Push Drizzle schema to database
pnpm db:pull      # Pull schema from database
pnpm test         # Run vitest tests
```

## Path Aliases

- `~~` or `@@` → Project root
- `~` or `@` → `app/` (Nuxt 4 core)
- `#server` → `server/` (backend directory)

**Important**: Files in `shared/` must be explicitly imported (not auto-imported) for code traceability.

```ts
import { randomUuid } from '~/shared/utils/uuid'
import { SysUserAddDTO } from '~/shared/system/user'
```

## Backend Architecture

Three-layer architecture with tRPC:

```
Router (Controller) layer - server/sys-router/*/index.ts
    ↓ Only calls Service, no business logic
Service layer - server/sys-router/*/SysUserService.ts
    ↓ Business logic, returns DTO
Repository (DAO) layer - server/sys-router/*/SysUserRepo.ts
    ↓ Returns Drizzle ORM types
Database
```

**tRPC Procedures**:
- `publicProcedure` - No authentication required
- `protectedProcedure` - Uses `loggerMiddleware` then `authMiddleware` (requires authentication)
- Custom procedures: `t.procedure.use(middleware)`

**Error Handling**: Centralized in `server/trpc/errorFormatter.ts`. Handles:
- Zod validation errors (returns field/form errors with translated messages)
- Drizzle/database errors (extracts original error message)

## Repository Pattern

`CommonRepo` factory (`server/drizzle/CommonRepo.ts`) provides standard CRUD operations:
- `list(dto)` - Query with dynamic where conditions
- `page(page, pageSize, dto)` - Paginated query with total count
- `getById(id)` - Get single record by ID
- `getOne(req)` - Get by conditions
- `create(data)` - Insert with `isDeleted: 0`
- `updateById(id, data)` - Partial update
- `remove(id)` - Soft delete (sets `isDeleted: 1`)

All repo methods automatically apply scope conditions from `buildScope()`.

## Schema & Validation Patterns

**Base Schema (`shared/system/user/common.ts`)**:
- Defines common properties matching Drizzle schema
- All properties must use `.nullish()`
- Use `.meta({ query: 'like' })` for query behavior
- No error messages defined here (only field + meta)

```ts
export const SysUserBaseSchema = z.object({
  id: z.string().nullish(),
  username: z.string().nullish().meta({ query: 'like' })
})
```

**Input/Output Schemas (`shared/system/user/input.ts`)**:
- Don't inherit BaseSchema rules directly (avoid `.shape.id` patterns)
- Use factory functions for custom error messages (enables i18n)
- Prefer over-specification to under-specification

**Frontend Validation**: Use `useZodValidation` composable for form/field validation with i18n error translation.

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Vue components | PascalCase | `UserProfile.vue` |
| Schema/DTO | PascalCase | `SysUserBaseSchema`, `SysUserAddDTO` |
| Files/routes/dirs | kebab-case | `pages/user-profile.vue` |
| Database entities | camelCase + `sys` prefix | `sysUser`, `sysRole` |
| Service layer | `EntityName + Service` | `SysUserService` |
| Repository layer | `EntityName + Repo` | `SysUserRepo` |

**System modules** use `sys` prefix consistently:
- Tables: `sysUser`, `sysRole`
- tRPC paths: `server/sys-router/user`

## Module Structure

When adding a new module (e.g., "department"):

1. **Database Schema**: `server/drizzle/schema/sysDepartment.ts`
2. **Shared Types**: `shared/system/department/`
   - `common.ts` - Base schema
   - `input.ts` - Input DTOs (add/update/query)
   - `output.ts` - Output DTOs
3. **Backend**: `server/sys-router/department/`
   - `index.ts` - tRPC router (controller)
   - `SysDepartmentService.ts` - Business logic
   - `SysDepartmentRepo.ts` - Optional custom queries (else use CommonRepo)
4. **Frontend**: `pages/system/department/` with Nuxt UI components

## Key Files Reference

- `server/trpc/init.ts` - tRPC initialization and procedure exports
- `server/trpc/context.ts` - Request context (db, session)
- `server/trpc/routers.ts` - Aggregates all module routers
- `server/drizzle/db.ts` - Database connection pool
- `server/drizzle/schema/` - Drizzle ORM schema definitions
- `shared/types/common.ts` - Shared TypeScript types
