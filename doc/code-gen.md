# xxdl-nuxt-admin 代码生成指南

> 本文档用于指导 AI 根据已有 demo 模板生成新的业务模块代码。
> 项目结构：Nuxt 4 + Nuxt UI v4 + tRPC + Drizzle ORM + MySQL，前后端一体。

---

## 使用方式

用户让 AI 生成新模块时，使用以下格式的提示词：

```
我已建好 <表名> 表，模块名 <module>，业务名 <business>，请根据 `d:\ws_project\xxdl-nuxt-admin\doc\code-gen.md` 帮我生成代码。
```
**参数说明**：

| 参数 | 说明 | 示例 |
|------|------|------|
| `<表名>` | 数据库表名（snake_case） | `my_business` |
| `<module>` | 模块目录名，支持两级（用 `/` 分隔） | `demo` 或 `system/user` |
| `<business>` | 业务名称（用作文件名/路由名等） | `Demo` 或 `SysUser` |

> 单级模块示例：
> ```
> 我已建好 demo 表，模块名 demo，业务名 Demo，请根据 `d:\ws_project\xxdl-nuxt-admin\doc\code-gen.md` 帮我生成代码。
> ```
>
> 两级模块示例：
> ```
> 我已建好 sys_user 表，模块名 system/user，业务名 SysUser，请根据 `d:\ws_project\xxdl-nuxt-admin\doc\code-gen.md` 帮我生成代码。
> ```
>```
>我已建好 sys_department表，模块名 system/department，业务名 SysDept，请根据 `doc\code-gen.md` 帮我生成代码。
>```


---

## 一、命名规则

- 模块目录以 **模块名/业务名** 形式组织（支持两级目录），例如 `system/user`、`system/role`、`system/dictType`
- AI 需向用户确认模块名，例如"请输入模块名（如 `demo` 或 `system/user`）"
- 所有文件名、路由名、翻译 key 均以此模块名为基础

---

## 二、完整步骤

### Step 1: 数据库建表（用户手动完成）

AI 给出建表 SQL 脚本示例（参考 `doc/mysql_init.sql`），提示用户在数据库中手动执行。

```sql
CREATE TABLE `demo` (
  `id` varchar(36) NOT NULL,
  `field1` varchar(100) DEFAULT NULL,
  `field2` varchar(100) DEFAULT NULL,
  `status` tinyint DEFAULT '1',
  `remark` varchar(255) DEFAULT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_by` varchar(36) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` tinyint DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

> **必须包含字段**：`id`(varchar 36 PK)、`created_by`、`created_at`、`updated_by`、`updated_at`、`is_deleted`(tinyint default 0)
>
> **用户确认后** AI 再继续后续步骤。

> 建完数据库后，到 `.env` 文件中确认数据库环境变量配置正确
> 包括 DB_HOST、DB_USER、DB_PASSWORD、DB_DATABASE 都要填对

### Step 2: AI 拉取数据库生成 Drizzle Schema

**用户确认建表完成后**，AI 执行：

```bash
pnpm db:pull
```

生成文件：`server/drizzle/out/schema.ts` + `server/drizzle/out/relations.ts`

### Step 3: AI 对比发现新表 → 用户确认

AI 读取 `server/drizzle/out/schema.ts`，对比已有的 `server/drizzle/schema/` 目录下的文件，找出新增的表定义。

> **AI 操作**：
> 1. 读取 `out/schema.ts` 中的所有表定义
> 2. 对比 `server/drizzle/schema/` 下已有的导出（读取 `schema/index.ts` 即可）
> 3. 列出新发现的表名和字段结构
> 4. **提示用户确认**这些表是否属于本次要生成的模块

**用户确认后**，AI 将新的表定义复制到 `server/drizzle/schema/<module>/index.ts`

**目录创建规则**：
- 单级模块：`server/drizzle/schema/demo/index.ts`
- 两级模块：`server/drizzle/schema/system/user.ts`
- 如果需要使用表格目录，如 system/user 的变量名称是 sysUser，须确认

**文件内容示例**（`server/drizzle/schema/demo/index.ts`）：

```typescript
import { mysqlTable, primaryKey, varchar, tinyint, timestamp } from "drizzle-orm/mysql-core"

export const demo = mysqlTable("demo", {
    id: varchar({ length: 36 }).notNull(),
    status: tinyint().default(1),
    remark: varchar({ length: 255 }),
    createdBy: varchar("created_by", { length: 36 }),
    createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
    updatedBy: varchar("updated_by", { length: 36 }),
    updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
    isDeleted: tinyint("is_deleted").default(0),
    // ... 业务字段
    field1: varchar({ length: 100 }),
    field2: varchar({ length: 100 }),
},
(table) => [
    primaryKey({ columns: [table.id], name: "demo_id" }),
]);
```

> **注意**：copy 时清理掉生成文件中多余的 import（如 `mysqlSchema`、`AnyMySqlColumn`、`sql`），只保留需要的

### Step 4: 在 Schema Index 中导出

`server/drizzle/schema/index.ts`：

**变量命名规则**：将数据库表名从 snake_case 转为 camelCase 作为变量名。例如：

| 数据库表名 | Drizzle 变量名 | 模块路径 |
|-----------|---------------|---------|
| `demo` | `demo` | `demo/index.ts` |
| `sys_user` | `sysUser` | `system/user.ts` |
| `sys_role` | `sysRole` | `system/role.ts` |

```typescript
// 单级模块示例（demo）
import { demo } from "./demo/index"

// 两级模块示例（system/user）
import { sysUser } from "./system/user"

// 导出（添加到已有 export 中）
export {
  demo,
  sysUser,
  // ... 其他表
};
```

> **注意**：如果表名没有明显的 camelCase 对应规则（如无法从蛇形命名推断），AI 需向用户确认变量命名。

---

### Step 5: 创建共享类型（shared）

**目录结构**：`shared/<module>/` 下创建 4 个文件

#### 5.1 common.ts — 基础 Schema（对应数据库字段）

```typescript
import z from 'zod'

export const DemoBaseSchema = z.object({
    id: z.string().nullish(),
    field1: z.string().nullish().meta({ query: 'like' }),  // .meta({query:'like'}) 用于模糊查询
    field2: z.string().nullish().meta({ query: 'like' }),
    status: z.number().nullish(),
    remark: z.string().nullish().meta({ query: 'like' }),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type DemoDto = z.infer<typeof DemoBaseSchema>
```

> **关键约定**：
> - 需要模糊查询的字段加 `.meta({ query: 'like' })`，会自动生成 `LIKE %xxx%` 查询条件
> - 精确查询字段不加 meta
> - 所有字段设为 nullish（可选），便于继承和复用
> - 所有字段设为 nullish，但**在 input.ts 和 output.ts 中**，如果 DB schema 中该字段有 `.notNull()`，则需要改为对应的必填类型

#### 5.2 input.ts — 输入 Schema（增/删/改/查 DTO）

```typescript
import { DemoBaseSchema } from './common'
import { z } from 'zod'
import { ApiRequestSchema } from "#shared/types/common";

// 新增
export const DemoAddSchema =
    DemoBaseSchema.pick({
        field1: true,
        field2: true,
        status: true,
        remark: true,
    }).extend({
        id: DemoBaseSchema.shape.id.nonoptional()
    })
export type DemoAddDTO = z.infer<typeof DemoAddSchema>;

// 修改（在 AddSchema 基础上让 id 必填）
export const DemoUpdateSchema = DemoAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type DemoUpdateDTO = z.infer<typeof DemoUpdateSchema>;

// 查询条件
export const DemoQuerySchema = DemoBaseSchema.pick({
    id: true,
    field1: true,
    field2: true,
    status: true,
    remark: true,
})
export type DemoQueryDTO = z.infer<typeof DemoQuerySchema>;

// 分页查询（继承查询条件 + 分页参数）
export const DemoPageQuerySchema =
    DemoQuerySchema.extend(ApiRequestSchema.shape)
export type DemoPageQueryDTO = z.infer<typeof DemoPageQuerySchema>;
```

#### 5.3 output.ts — 输出 Schema（可选，用于定制响应字段）

```typescript
import { DemoBaseSchema } from './common'
import { z } from 'zod'

export const DemoRespSchema = z.object({
    id: DemoBaseSchema.shape.id,
    field1: DemoBaseSchema.shape.field1,
    field2: DemoBaseSchema.shape.field2,
    status: DemoBaseSchema.shape.status,
    remark: DemoBaseSchema.shape.remark,
});
export type DemoRespDTO = z.infer<typeof DemoRespSchema>;
```

#### 5.4 index.ts — 统一导出

```typescript
export * from './common'
export * from './input'
export * from './output'
```

---

### Step 6: 创建后端 Repo

`server/<module>-router/<ModuleRepo>.ts`

```typescript
import { CommonRepo } from "#server/drizzle/CommonRepo";
import { DemoBaseSchema } from "#shared/demo/common";
import { demo } from "~~/server/drizzle/schema";

export const demoRepo = CommonRepo(demo, DemoBaseSchema)
```

**原理**：`CommonRepo` 是一个工厂函数，接收 drizzle table 和 zod schema，自动生成 `list/page/getById/getOne/create/updateById/remove/batchRemove` 等方法。Zod schema 中的 `.meta({query:'like'})` 会被 `buildWhereBySchema` 自动解析为模糊查询条件。

---

### Step 7: 创建后端 Service

`server/<module>-router/<ModuleService>.ts`

```typescript
import { demoRepo } from './DemoRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { DemoAddDTO, DemoDto, DemoPageQueryDTO, DemoQueryDTO, DemoUpdateDTO } from "#shared/demo";
import { randomUuid } from "#shared/utils/uuid";

export function demoService(ctx: Context) {
    const repo = demoRepo(ctx)

    return {
        async create(data: DemoAddDTO): Promise<boolean> {
            const uuid = randomUuid()         // 自动生成主键
            const pojo = { ...data, id: uuid }
            await repo.create(pojo)
            return true
        },
        async remove(id: string): Promise<boolean> {
            await repo.remove(id)
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            return ids.length
        },
        async updateById(id: string, data: DemoUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            return true
        },
        async getOne(req: DemoQueryDTO): Promise<DemoDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async getById(id: string): Promise<DemoDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async page(req: DemoPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            return await repo.page(page, pageSize, dto)
        },
        async list(dto: any): Promise<DemoDto[]> {
            return await repo.list(dto)
        },
    }
}
```

---

### Step 8: 创建后端 Router（tRPC）

`server/<module>-router/index.ts`

```typescript
//#server/<module>-router
import { router, protectedProcedure } from '~~/server/trpc/init'
import { demoService } from './DemoService'
import z from 'zod'
import { DemoAddSchema, DemoUpdateSchema, DemoQuerySchema, DemoPageQuerySchema } from "#shared/demo";

export const demoRouter = router({
    create: protectedProcedure.input(DemoAddSchema)
        .mutation(async ({ ctx, input }) => {
            return demoService(ctx).create(input)
        }),
    remove: protectedProcedure.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return demoService(ctx).remove(input)
        }),
    batchDelete: protectedProcedure.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return demoService(ctx).batchRemove(input)
        }),
    update: protectedProcedure.input(DemoUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return demoService(ctx).updateById(input.id, input)
        }),
    getOne: protectedProcedure.input(DemoQuerySchema)
        .query(async ({ ctx, input }) => {
            return demoService(ctx).getOne(input)
        }),
    getById: protectedProcedure.input(z.string())
        .query(async ({ ctx, input }) => {
            return demoService(ctx).getById(input)
        }),
    page: protectedProcedure.input(DemoPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return demoService(ctx).page(input)
        })
})
```

> **注意**：固定 7 个接口方法（create / remove / batchDelete / update / getOne / getById / page），确保一致性

---

### Step 9: 注册 tRPC Router

`server/trpc/routers.ts`

```typescript
import { router } from '~~/server/trpc/init'
import { demoRouter } from '#server/demo-router'

export const appRouter = router({
    // ... 已有路由
    demo: demoRouter,   // 添加新路由
});

export type AppRouter = typeof appRouter;
```

---

### Step 10: 创建前端页面

`app/pages/<module>/index.vue`, 以snake_case形式命名

> 使用显式布局 `system`（通过 `definePageMeta`），导入要有显式文件后缀 `.vue`

核心要点：
- 使用 `usePaginatedTable` hook 管理分页
- 使用 `useTableOperate` hook 管理新增/编辑/删除
- 使用 `useSelectionColumn` + `useBadgeColumn` 辅助列配置
- 通过 `$trpc.<module>.<method>` 调用后端 API
- 使用 `$ts()` 翻译 i18n key

**关键依赖导入**：
```typescript
import type { DemoDto, DemoQueryDTO } from "#shared/demo"
import DemoSearch from './components/demo-search.vue'
import DemoOperate from "./components/demo-operate.vue"
```

布局声明：
```typescript
definePageMeta({
  layout: 'system'
})
```

完整示例参考：[app/pages/demo/index.vue](file:///d:/ws_project/xxdl-nuxt-admin/app/pages/demo/index.vue)

---

### Step 11: 创建前端搜索组件

`app/pages/<module>/components/<module>-search.vue`, 以snake_case形式命名

- 使用 `UForm` + `UFormField` + `UBaseInput` / `USelect` 构建搜索表单
- 通过 `@search` emit 触发列表查询
- 使用 `translateOptions` 函数将常量配置转为可选项（`import { translateOptions } from "~/utils/common"`）

> **⚠️ 常见错误**：注意 import 的 Schema 必须与当前模块匹配。搜索组件的 `schema` 变量指向当前模块的 `QuerySchema`

---

### Step 12: 创建前端操作弹窗组件

`app/pages/<module>/components/<module>-operate.vue`, 以snake_case形式命名

- 使用 `UModal` 作为弹窗容器
- 使用 `UForm` + `useZodValidation` 做表单验证
- 根据 `operateType`（add / edit）动态使用 `AddSchema` 或 `UpdateSchema`
- 通过 `$trpc.<module>.create.mutate()` 和 `$trpc.<module>.update.mutate()` 提交

---

### Step 13: 添加翻译 key

#### 13.1 前端翻译（`app/locales/{zh,en}.json`）

在 `module` 对象下添加模块翻译，结构如下：

```json
{
  "module": {
    "<module>": {
      "title": "Demo列表 / Demo List",
      "<field1>": "字段1 / field1",
      "<field2>": "字段2 / field2",
      "<status>": "Demo状态 / demoStatus",
      "form": {
        "<field1>": "请输入字段1 / Please enter field1",
        "<field2>": "请输入字段2 / Please enter field2",
        "<status>": "请选择状态 / Please select demo status"
      },
      "add<Module>": "新增Demo / add Demo",
      "edit<Module>": "编辑Demo / edit Demo"
    }
  }
}
```

需要同时修改两个文件：
- [app/locales/zh.json](file:///d:/ws_project/xxdl-nuxt-admin/app/locales/zh.json)
- [app/locales/en.json](file:///d:/ws_project/xxdl-nuxt-admin/app/locales/en.json)


---

### Step 14: 业务常量配置（可选）

如果模块有状态/枚举字段需要在表格中展示 badge 或下拉选择，需在 `shared/constants/business.ts` 中添加配置：

**状态 badge 配置**（用于展示彩色标签）：
```typescript
export const <MODULE>_STATUS_CONFIG = {
    '1': { i18nKey: 'page.manage.common.status.enable', color: 'success' },
    '2': { i18nKey: 'page.manage.common.status.disable', color: 'warning' }
} as const
```

**下拉选项配置**（用于搜索/表单下拉框）：
```typescript
export const <module>StatusRecord: Record<string, string> = {
    '1': 'page.manage.common.status.enable',
    '2': 'page.manage.common.status.disable'
};

export const <module>StatusOptions = transformRecordToOption(<module>StatusRecord);
```

---

## 三、路径别名对照

| 别名 | 实际路径 | 使用场景 |
|------|----------|----------|
| `~~/` | 项目根目录 | 后端 import `server/drizzle/schema` 等 |
| `#shared/` | `shared/` | 前后端共享类型、常量 |
| `#server/` | `server/` | 后端 import repo、service、utils |
| `~/` | `app/` | 前端 import 组件、composable |

---

## 四、文件清单模板（共约 14 个文件/修改点）

用户确认模块名后（如 `<module>`），AI 需要创建/修改以下文件：

| # | 文件路径 | 操作 | 说明 |
|---|----------|------|------|
| 1 | MySQL 建表 SQL | 新建 | 在数据库中执行 |
| 2 | `server/drizzle/schema/<module>/index.ts` | **新建** | 从 `out/schema.ts` copy 并清理 |
| 3 | `server/drizzle/schema/index.ts` | **修改** | 添加 export |
| 4 | `shared/<module>/common.ts` | **新建** | 基础 Zod Schema |
| 5 | `shared/<module>/input.ts` | **新建** | 增删改查 DTO |
| 6 | `shared/<module>/output.ts` | **新建** | 响应 DTO |
| 7 | `shared/<module>/index.ts` | **新建** | 统一导出 |
| 8 | `server/<module>-router/<Module>Repo.ts` | **新建** | CommonRepo 工厂 |
| 9 | `server/<module>-router/<Module>Service.ts` | **新建** | 业务逻辑 |
| 10 | `server/<module>-router/index.ts` | **新建** | tRPC 路由定义 |
| 11 | `server/trpc/routers.ts` | **修改** | 注册路由 |
| 12 | `app/pages/<module>/index.vue` | **新建** | 列表页面 |
| 13 | `app/pages/<module>/components/<module>-search.vue` | **新建** | 搜索组件 |
| 14 | `app/pages/<module>/components/<module>-operate.vue` | **新建** | 新增/编辑弹窗 |
| 15 | `app/locales/zh.json` | **修改** | 添加中文翻译 |
| 16 | `app/locales/en.json` | **修改** | 添加英文翻译 |
| 17 | `server/assets/_locales/merged/<module>/zh` | **新建** | 服务端中文翻译 |
| 18 | `shared/constants/business.ts` | **修改** | 业务常量（可选） |

---

## 五、注意事项 & 已知问题

1. **Schema `out/schema.ts`** 是自动生成的，可能包含 typo（如 `filed1` vs `field1`），复制到 `server/drizzle/schema/` 后需要人工检查修正
2. **搜索组件**的 `schema` 变量必须正确引用当前模块的 `QuerySchema`
3. **新增接口的 id** 由 Service 层通过 `randomUuid()` 生成，前端新增表单不需要传 id
4. **模糊查询**通过在 common.ts 的字段上加 `.meta({ query: 'like' })` 实现，后端 `buildWhereBySchema` 自动解析
5. **所有路由使用 `protectedProcedure`**（需要登录认证），除非有特殊需求才用 `publicProcedure`
6. **前端组件 import 必须有显式后缀 `.vue`**
7. **`AppError`** 接收 i18n key 作为参数，客户端会自动翻译显示
8. **input.ts / output.ts 的 NOT NULL 规则**：生成 input.ts 和 output.ts 时，必须根据 DB schema 的 `.notNull()` 设置字段。`common.ts` 的 `BaseSchema` 统一使用 `.nullish()` 便于复用，但在 `AddSchema`/`RespSchema` 中，DB `NOT NULL` 的**业务字段**需通过 `extend()` 覆盖为必填（如 `z.string()` 而非 `z.string().nullish()`）。ID 字段在 `AddSchema` 中用 `.nonoptional()`，在 `UpdateSchema` 中用 `.nonempty()`；`createdAt`/`updatedAt` 等 DB 自管字段保持 `nullish`。
