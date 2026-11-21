export const CODEGEN_AI_GUIDE = `# 代码生成 V2（AI 接入）

V2 不在服务端调用大模型。系统只提供生成结果、合并计划和文档，由外部 AI/CLI 自己读取、写入和合并。

## 1. 鉴权

- 外部 AI/CLI：\`Authorization: Bearer <NUXT_CODEGEN_TOKEN>\`
- 后台会话：已登录且拥有 \`system:gen:*\` 权限时也可调用。

## 2. 接口

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | /api/system/gen/ai/guide | 本指南 |
| GET | /api/system/gen/ai/tables | 已导入的生成配置 |
| GET | /api/system/gen/ai/prompt?tableId=... | 后台列表行「AI」按钮使用的提示词（含短期令牌） |
| POST | /api/system/gen/ai/plan | 返回文件与合并计划 |
| POST | /api/system/gen/ai/download | 返回 zip |

plan 请求：

~~~json
{
  "tableName": "sys_demo",
  "moduleName": "system/demo",
  "businessName": "SysDemo"
}
~~~

- \`tableName\` 必填；\`moduleName\`/\`businessName\` 可选。
- 未导入的表会自动从 INFORMATION_SCHEMA 导入。
- 响应包含 \`files\`（完整文件内容）、\`mergePlan\`、\`instructions\`。

## 3. CLI

~~~bash
pnpm gen:ai:guide
pnpm gen:ai:tables
pnpm gen:ai:plan --table=sys_demo --module=system/demo --business=SysDemo
pnpm gen:ai:download --table=sys_demo --out=.data/codegen
~~~

环境变量：

~~~env
CODEGEN_BASE_URL=http://127.0.0.1:3001
CODEGEN_TOKEN=<与 NUXT_CODEGEN_TOKEN 相同>
~~~

后台代码生成 V2 列表每一行的「AI」按钮会自动复制提示词（含表名/模块名/业务名和 15 分钟短期令牌），外部 AI 直接粘贴即可，无需手写环境变量。

## 4. 文件合并规则

### 4.1 新模块文件

按 \`files[].path\` 直接写入 \`packages/admin-core\` 对应路径。

### 4.2 server/drizzle/schema/index.ts

只追加：

~~~ts
// mergePlan.schemaIndex.importLine
// 并把 mergePlan.schemaIndex.exportEntry 加入 export 列表
~~~

不要整文件覆盖，避免丢失其它模块的导出。

### 4.3 server/trpc/routers.ts

只追加：

~~~ts
// mergePlan.routers.importLine
// 并把 mergePlan.routers.registration 加入 appRouter
~~~

不要整文件覆盖，避免丢失其它 router。

### 4.4 app/locales/zh.json / en.json

在 \`mergePlan.locales.jsonPath\` 指向的节点深合并 \`zhSubtree\` / \`enSubtree\`。

- 保留已有词条；
- 同名 key 以生成值为准，但不要删除其它 key；
- 两个文件都要合并。

### 4.5 菜单

执行 \`mergePlan.menuSql\`，先把 \`<MENU_ID>\`/\`<ADD_ID>\`/\`<EDIT_ID>\`/\`<DEL_ID>\` 替换为实际 UUID。

## 5. 验证

~~~bash
pnpm --filter xxdl-nuxt-admin-demo typecheck
pnpm check:layers
~~~

## 6. 给 AI 的提示词模板

~~~text
请先读取 GET /api/system/gen/ai/guide（或 docs/main/new-module/codegen-v2），然后：
1. 运行 pnpm gen:ai:plan --table=<tableName> [--module=<module>] [--business=<Business>]
2. 按返回的 files 写入文件；
3. 按 mergePlan 合并 schema/index.ts、routers.ts、app/locales/zh.json、app/locales/en.json；
4. 执行 mergePlan.menuSql；
5. 运行 pnpm --filter xxdl-nuxt-admin-demo typecheck 和 pnpm check:layers；
6. 如果失败，读取错误并修正生成文件后重试，不要改动无关文件。
~~~
`
