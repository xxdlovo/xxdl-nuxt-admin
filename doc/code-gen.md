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

**权限资源码规则**：
- 单级模块：`<module>`，例如 `demo`
- 多级模块：将 `/` 替换为 `:`，例如 `system/user` -> `system:user`
- 标准 CRUD 权限码固定为：`<resource>:list`、`<resource>:add`、`<resource>:edit`、`<resource>:del`

在文件顶部用 `proc({ permission })` 显式声明四个权限 procedure，再在路由里引用。
**不要使用 `crudPermissionProcedures` 工厂** —— 权限码隐式拼接不利于检索，项目已统一改为显式写法。

```typescript
//#server/<module>-router
import { router, proc } from '~~/server/trpc/init'
import { demoService } from './DemoService'
import z from 'zod'
import {
    DemoAddSchema,
    DemoUpdateSchema,
    DemoQuerySchema,
    DemoPageQuerySchema
} from '#shared/demo'

const listProc = proc({ permission: 'demo:list' })
const addProc = proc({ permission: 'demo:add' })
const editProc = proc({ permission: 'demo:edit' })
const delProc = proc({ permission: 'demo:del' })

export const demoRouter = router({
    create: addProc.input(DemoAddSchema)
        .mutation(async ({ ctx, input }) => {
            return demoService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return demoService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return demoService(ctx).batchRemove(input)
        }),
    update: editProc.input(DemoUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return demoService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(DemoQuerySchema)
        .query(async ({ ctx, input }) => {
            return demoService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return demoService(ctx).getById(input)
        }),
    page: listProc.input(DemoPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return demoService(ctx).page(input)
        })
})
```

> **注意**：固定 7 个接口方法（create / remove / batchDelete / update / getOne / getById / page），确保一致性。查询类统一用 `listProc`，新增用 `addProc`，修改用 `editProc`，删除与批量删除用 `delProc`。

### Step 8.1: 操作类型与 `proc()` 参数约定

#### 操作类型必须逐条核对

| 操作类型 | 用于哪些接口 |
|---------|-------------|
| `.query()` | `getOne`、`getById`、`page`、`list`（纯读取，无副作用） |
| `.mutation()` | `create`、`update`、`remove`、`batchDelete` |

> **⚠️ 常见错误**：把只做查询的接口写成 `.mutation()`（例如内部只调用 `getById` 的调试/统计接口）。生成后请逐个核对，读接口一律 `.query()`。

#### `proc()` 只传 `permission`

| 参数 | 是否需要显式声明 | 说明 |
|------|----------------|------|
| `permission` | **必传** | 权限码，规则见下方「权限资源码规则」 |
| `readonly` | 一般不传 | `NUXT_DEMO_MODE=true` 时由它统一决定，mutation 自动受保护，无需在控制器声明 |
| `log` | 一般不传 | 不传时按操作类型决定：mutation 记录、query 跳过（读操作过于频繁，不写审计日志）。需要审计查询时显式传 `log: true` |
| `dataScope` | 仅特殊接口传 | 默认应用数据权限。列表类接口若需要完整数据（树结构、选择器、授权），传 `dataScope: false` **并加注释说明原因** |

`dataScope: false` 示例（参考 `system/role`、`system/dept`）：

```typescript
// 角色列表类接口需要完整角色数据（用于选择器/授权），不做数据范围限制
const listProc = proc({ permission: 'system:role:list', dataScope: false })
```

#### 控制器文件格式化规范

- `.input(...)` 与 `.query(...)` / `.mutation(...)` **分两行书写**，方法体三行展开，禁止压成单行链式：

  ```typescript
  // ✅ 正确
  page: listProc.input(DemoPageQuerySchema)
      .query(async ({ ctx, input }) => {
          return demoService(ctx).page(input)
      }),

  // ❌ 错误：读起来困难，后续加逻辑容易出错
  page: listProc.input(DemoPageQuerySchema).query(({ ctx, input }) => demoService(ctx).page(input)),
  ```

- `import` 语句一行一个来源；从同一模块导入多个符号时用多行花括号，不要堆在一行。
- 文件首行保留 `//#server/<module>-router` 定位注释。

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

### Step 9.1: 配置 RBAC 菜单与按钮权限

接口级权限和前端按钮权限都依赖 `sys_menu.code`。生成新模块时，必须同步规划并写入权限码，否则普通用户即使有角色也无法访问对应接口。

**权限码规则**：

| 操作 | 权限码示例 |
|------|----------|
| 列表/详情/查询 | `demo:list` |
| 新增 | `demo:add` |
| 修改 | `demo:edit` |
| 删除/批量删除 | `demo:del` |

多级模块示例：`system/user` 对应 `system:user:list`、`system:user:add`、`system:user:edit`、`system:user:del`。

AI 生成模块时需要给出菜单/按钮权限初始化 SQL，或提示用户在系统菜单中维护这些权限码。示例：

```sql
-- 页面菜单：用于侧边栏入口和页面访问
-- code 用 <resource>:list；path 为页面路由；component 为 app/pages 下的相对路径
INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
VALUES
  ('<menu_id>', '<parent_dir_id>', 'Demo管理', 'demo:list', 1, '/demo', 'demo/index', 'i-lucide-table', 40, 0, 1, 'Demo列表权限', '<admin_id>', '<admin_id>', 0);

-- 按钮权限：用于新增/编辑/删除按钮和接口权限
INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
VALUES
  ('<add_id>', '<menu_id>', 'Demo新增', 'demo:add', 2, NULL, NULL, NULL, 1, 1, 1, 'Demo新增权限', '<admin_id>', '<admin_id>', 0),
  ('<edit_id>', '<menu_id>', 'Demo编辑', 'demo:edit', 2, NULL, NULL, NULL, 2, 1, 1, 'Demo编辑权限', '<admin_id>', '<admin_id>', 0),
  ('<del_id>', '<menu_id>', 'Demo删除', 'demo:del', 2, NULL, NULL, NULL, 3, 1, 1, 'Demo删除权限', '<admin_id>', '<admin_id>', 0);
```

> **`type` / `visible` 的真实取值以当前 `sys_menu` 数据为准**（已核对线上表）：
>
> | 层级 | `type` | `visible` | 说明 |
> |------|--------|-----------|------|
> | 目录 | `0` | `0` | 仅作为父节点分组，如「系统管理」「文件管理」 |
> | 页面菜单 | `1` | `0` | 侧边栏可见的页面入口，`path` 指向路由，`component` 指向 `app/pages` 下相对路径 |
> | 按钮权限 | `2` | `1` | `path`/`component` 留空，仅提供 `code` 用于接口与按钮鉴权 |
>
> 页面菜单需先在 `sys_menu` 中找到合适的父目录（如 `system` 目录或更细的 `system:file` 分组）作为 `parent_id`；目录本身无 `path`/`component`。

---

### Step 10: 创建前端页面

`app/pages/<module>/index.vue`, 以snake_case形式命名

> 使用显式布局 `system`（通过 `definePageMeta`），导入要有显式文件后缀 `.vue`

核心要点：
- 使用 `usePaginatedTable` hook 管理分页
- 使用 `useTableOperate` hook 管理新增/编辑/删除
- 使用 `useSelectionColumn` + `useBadgeColumn` 辅助列配置
- 使用 `useCrudPermissions('<resource>')` 生成前端 CRUD 权限码和权限状态
- `TableHeaderOperation` 必须传入 `:add-permission="permissions.codes.add"` 和 `:delete-permission="permissions.codes.del"`
- 行编辑按钮通过 `permissions.canEdit` 控制，行删除按钮通过 `permissions.canDel` 控制
- 没有删除权限时隐藏选择列，没有编辑/删除权限时隐藏操作列
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

权限声明示例：
```typescript
const demoPermissions = useCrudPermissions('demo')
```

顶部操作示例：
```vue
<TableHeaderOperation
  :add-permission="demoPermissions.codes.add"
  :delete-permission="demoPermissions.codes.del"
/>
```

表格列权限示例：
```typescript
const columns = computed<TableColumn<DemoDto>[]>(() => {
  const actionColumn: TableColumn<DemoDto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      if (demoPermissions.canEdit.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          onClick: () => handleEdit(row.original.id as string)
        }, { default: () => $ts('common.edit') }))
      }

      if (demoPermissions.canDel.value) {
        actions.push(h(Popconfirm, {
          onConfirm: () => handleDelete(row.original.id as string)
        }, {
          trigger: () => h(UButton, {
            variant: 'outline',
            color: 'error',
            size: 'xs'
          }, { default: () => $ts('common.delete') })
        }))
      }

      return h('div', { class: 'flex gap-2' }, actions)
    }
  }

  return [
    ...(demoPermissions.canDel.value ? [selectionColumn] : []),
    // ...业务列
    ...(demoPermissions.canOperate.value ? [actionColumn] : [])
  ]
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

**唯一落点**：`app/locales/zh.json` 与 `app/locales/en.json` 的 `module` 对象下。

> **⚠️ 不要手写 `app/locales/pages/**`** —— 该目录已被 `.gitignore` 忽略，是 `nuxt-i18n-micro` 在构建时生成的产物（当前多为空 `{}`）。同理 `server/assets/_locales/` 也是产物。手写进去会在下次构建时被覆盖。

多级模块用嵌套 key 表达：模块名 `system/ossConfig` 对应 `module.system.ossConfig`，代码里以 `$ts('module.system.ossConfig.title')` 引用。

结构如下（以 `system/oauthAccount` 为真实范例）：

```json
{
  "module": {
    "system": {
      "oauthAccount": {
        "title": "第三方账号绑定",
        "provider": "登录平台",
        "providerUserId": "平台用户ID",
        "providerLogin": "平台账号",
        "userId": "系统用户ID",
        "createdAt": "创建时间",
        "form": {
          "provider": "请输入登录平台，例如 github",
          "providerUserId": "请输入平台用户ID",
          "providerLogin": "请输入平台账号",
          "userId": "请输入系统用户ID"
        },
        "addSysOauthAccount": "新增绑定",
        "editSysOauthAccount": "编辑绑定"
      }
    }
  }
}
```

约定：
- `form.*` 子对象存放表单占位符与校验提示
- `add<Business>` / `edit<Business>` 命名新增/编辑弹窗标题，`<Business>` 用业务名（如 `SysOauthAccount`）
- `title` 用于列表页标题与表头前缀

需要同时修改两个文件：
- [app/locales/zh.json](file:///d:/ws_project/xxdl-nuxt-admin/app/locales/zh.json)
- [app/locales/en.json](file:///d:/ws_project/xxdl-nuxt-admin/app/locales/en.json)

#### 13.2 校验方法

生成后建议逐个核对页面里的 `$ts('...')` 是否都能在 locale 文件中查到：

```powershell
# 提取页面中所有 $ts('key') 并在 zh.json 里查找
Select-String -Path app/pages/<module>/**/*.vue -Pattern "\`$ts\('([^']+)'\)" -AllMatches |
  ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
```

另需确认两个 JSON 文件仍能正常解析（`ConvertFrom-Json` / `JSON.parse`），插入时注意逗号与缩进。


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

> 路由注册名（`appRouter` 的 key）**直接决定前端调用前缀**：注册为 `sysOauthAccount`，前端就必须写 `$trpc.sysOauthAccount.page.query()`。写错前缀时 tRPC 返回的是 `No procedure found on path "..."`（HTTP 404），而不是鉴权错误，容易误判成路由没注册。

### 9.2 命名约定对照（务必逐级对应）

以 `sys_oauth_account` 为例，同一实体的名字在不同层风格不同，**不要混用**：

| 层次 | 命名 | 说明 |
|------|------|------|
| 数据库表名 | `sys_oauth_account` | snake_case |
| Drizzle 变量 | `sysOauthAccount` | 表名转小驼峰 |
| schema 文件 | `server/drizzle/schema/system/oauthAccount.ts` | 去掉 `sys_` 前缀的小驼峰 |
| 模块名 | `system/oauthAccount` | `<一级目录>/<业务目录>` |
| 业务名 | `SysOauthAccount` | 大驼峰，用于 `SysOauthAccountRepo` / `SysOauthAccountService` / 各 Schema |
| 资源码（权限码前缀） | `system:oauthAccount` | 模块名把 `/` 换成 `:` |
| **tRPC 路由名** | **`sysOauthAccount`** | 与 Drizzle 变量同名（保留 `sys` 前缀），前端 `$trpc.sysOauthAccount.*` |
| 页面目录 | `app/pages/system/oauth-account/` | kebab-case |
| i18n key | `module.system.oauthAccount` | 保留小驼峰 |

> **易错点**：tRPC 路由名用 `sys` 前缀（`sysOauthAccount`），而资源码/i18n 用 `system`（`system:oauthAccount`）。两者不相同，生成时以本表为准。
>
> 参考现有模块：`sysUser` / `sysOss` / `sysOssConfig` / `sysDictType` 均为 `sys` 前缀路由名。

---

## 三、路径别名对照

| 别名 | 实际路径 | 使用场景 |
|------|----------|----------|
| `~~/` | 项目根目录 | 后端 import `server/drizzle/schema` 等 |
| `#shared/` | `shared/` | 前后端共享类型、常量 |
| `#server/` | `server/` | 后端 import repo、service、utils |
| `~/` | `app/` | 前端 import 组件、composable |

---

## 四、文件清单模板（共约 19 个文件/修改点）

用户确认模块名后（如 `<module>` = `system/oauthAccount`，业务名 `<Business>` = `SysOauthAccount`），AI 需要创建/修改以下文件：

| # | 文件路径 | 操作 | 说明 |
|---|----------|------|------|
| 1 | MySQL 建表 SQL | 新建 | 在数据库中执行 |
| 2 | `server/drizzle/schema/system/<business>.ts` | **新建** | 从 `out/schema.ts` copy 并清理（两级模块用**小驼峰文件名**，如 `oauthAccount.ts`） |
| 3 | `server/drizzle/schema/index.ts` | **修改** | 添加 import 与 export |
| 4 | `shared/<module>/common.ts` | **新建** | 基础 Zod Schema |
| 5 | `shared/<module>/input.ts` | **新建** | 增删改查 DTO |
| 6 | `shared/<module>/output.ts` | **新建** | 响应 DTO |
| 7 | `shared/<module>/index.ts` | **新建** | 统一导出 |
| 8 | `server/sys-router/<business>/<Business>Repo.ts` | **新建** | CommonRepo 工厂 |
| 9 | `server/sys-router/<business>/<Business>Service.ts` | **新建** | 业务逻辑 |
| 10 | `server/sys-router/<business>/index.ts` | **新建** | tRPC 路由定义 |
| 11 | `server/trpc/routers.ts` | **修改** | 注册路由 |
| 12 | `app/pages/<module-kebab>/index.vue` | **新建** | 列表页面（目录名 kebab-case，`system/oauthAccount` → `system/oauth-account`） |
| 13 | `app/pages/<module-kebab>/components/sys-<business-kebab>-search.vue` | **新建** | 搜索组件 |
| 14 | `app/pages/<module-kebab>/components/sys-<business-kebab>-operate.vue` | **新建** | 新增/编辑弹窗 |
| 15 | `app/locales/zh.json` | **修改** | `module.<module>.<business>` 下添加中文翻译 |
| 16 | `app/locales/en.json` | **修改** | 同上，英文翻译 |
| 17 | `sys_menu` 权限数据 | **新增/配置** | 页面菜单（`type=1`）与 `list/add/edit/del` 按钮权限（`type=2`） |
| 18 | ~~`server/assets/_locales/merged/...`~~ | **勿手写** | 构建产物，由 `app/locales` 生成 |
| 19 | `shared/constants/business.ts` | **修改** | 业务常量（可选，仅当有状态/枚举字段需 badge 或下拉时） |

> 第 2 项的目录层级由模块名决定：单级模块用 `server/drizzle/schema/<module>/index.ts`（如 `demo/index.ts`），两级模块用 `server/drizzle/schema/<一级>/<业务名>.ts`（如 `system/oauthAccount.ts`）。

---

## 五、注意事项 & 已知问题

1. **Schema `out/schema.ts`** 是自动生成的，可能包含 typo（如 `filed1` vs `field1`），复制到 `server/drizzle/schema/` 后需要人工检查修正；同时清理多余 import（`mysqlSchema`、`AnyMySqlColumn`、`sql`、`json`、`longtext` 等只保留实际用到的）
2. **搜索组件**的 `schema` 变量必须正确引用当前模块的 `QuerySchema`
3. **新增接口的 id** 由 Service 层通过 `randomUuid()` 生成，前端新增表单不需要传 id
4. **模糊查询**通过在 common.ts 的字段上加 `.meta({ query: 'like' })` 实现，后端 `buildWhereBySchema` 自动解析
5. **控制器统一使用 `proc({ permission })`**，权限码显式书写（如 `system:oauthAccount:add`），不使用 `crudPermissionProcedures` 工厂。只有纯登录态接口才用 `protectedProcedure` / `permissionProcedure`
6. **前端组件 import 必须有显式后缀 `.vue`**
7. **`AppError`** 接收 i18n key 作为参数，客户端会自动翻译显示
8. **input.ts / output.ts 的 NOT NULL 规则**：生成 input.ts 和 output.ts 时，必须根据 DB schema 的 `.notNull()` 设置字段。`common.ts` 的 `BaseSchema` 统一使用 `.nullish()` 便于复用，但在 `AddSchema`/`RespSchema` 中，DB `NOT NULL` 的**业务字段**需通过 `extend()` 覆盖为必填（如 `z.string()` 而非 `z.string().nullish()`）。ID 字段在 `AddSchema` 中用 `.nonoptional()`，在 `UpdateSchema` 中用 `.nonempty()`；`createdAt`/`updatedAt` 等 DB 自管字段保持 `nullish`
9. **操作类型必须逐条核对**：读接口（`getOne`/`getById`/`page`/`list`）一律 `.query()`，写接口（`create`/`update`/`remove`/`batchDelete`）一律 `.mutation()`，详见 Step 8.1
10. **`dataScope: false` 仅在必要时添加**：列表接口需要全量数据（树结构、选择器、授权）时才传，并加注释说明原因，否则保持默认的数据权限过滤
11. **页面目录与 i18n key 的命名映射**：模块名 `system/oauthAccount` → 页面目录 `app/pages/system/oauth-account/`（kebab-case）→ i18n key `module.system.oauthAccount`（保留小驼峰）→ 资源码 `system:oauthAccount`。三者大小写风格不同，生成时不要混用
12. **`app/locales/pages/**` 与 `server/assets/_locales/**` 都是构建产物**（已 gitignore），不要手写，翻译只加在 `app/locales/{zh,en}.json`
