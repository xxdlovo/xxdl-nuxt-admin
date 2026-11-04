# xxdl-admin-trade

[`xxdl-admin-core`](https://www.npmjs.com/package/xxdl-admin-core) 的**可选电商业务层**（Nuxt Layer）。

在系统管理基座之上提供会员、商品、订单、支付、钱包、优惠券、等级与充值能力，并按电商场景覆盖了后台首页看板。

## 依赖关系

```
业务项目  →  xxdl-admin-trade  →  xxdl-admin-core
```

引入本层时会**自动带上基座**（`xxdl-admin-core` 是本层的依赖），不需要再单独写一次 `extends`。

## 安装

```bash
pnpm add -D xxdl-admin-trade
```

## 使用

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: ['xxdl-admin-trade']
})
```

只需要系统管理、不需要电商能力时，改为 `extends: ['xxdl-admin-core']` 即可（本层不参与安装）。

## 初始化数据库

先在基座的表结构上执行本层的增量脚本：

```bash
# 先执行基座（如果还没做）
mysql -u <user> -p <database> < node_modules/xxdl-admin-core/sql/mysql-ddl.sql
mysql -u <user> -p <database> < node_modules/xxdl-admin-core/sql/init.sql

# 再执行电商域
mysql -u <user> -p <database> < node_modules/xxdl-admin-trade/sql/mysql-ddl-goods-order.sql
mysql -u <user> -p <database> < node_modules/xxdl-admin-trade/sql/mysql-ddl-member-balance.sql
mysql -u <user> -p <database> < node_modules/xxdl-admin-trade/sql/mysql-ddl-member-level-price.sql

# 电商域的菜单与权限
mysql -u <user> -p <database> < node_modules/xxdl-admin-trade/sql/mysql-menu-goods-order.sql
mysql -u <user> -p <database> < node_modules/xxdl-admin-trade/sql/mysql-menu-member-level-order.sql
```

## 支付配置

支付渠道密钥使用 AES-256-GCM 加密存储，需要提供一个 32 字节主密钥（base64 或 64 位 hex）：

```dotenv
NUXT_PAY_CONFIG_KEY=<your-32-byte-key>
```

未配置时，非支付相关功能不受影响。

## 本层做了什么

| 位置 | 内容 |
|---|---|
| `app/pages/system/` | 会员、会员等级、优惠券、余额流水、冻结、充值、钱包、商品、订单、支付渠道、支付单、回调日志、商城、我的订单 |
| `server/trade-router/` | 上述模块的 tRPC router 与领域服务 |
| `server/api/pay/notify/[channel].post.ts` | 支付渠道异步回调入口 |
| `server/plugins/admin-trade.ts` | 向基座注册定时任务与用户建档钩子 |
| `server/api/trpc/[trpc].ts` | **覆盖**基座 handler，注册「基座 + 电商」合并后的路由 |
| `server/trpc/routers.ts` | 用 `t.mergeRouters` 合并两层路由 |
| `server/drizzle/schema/` | 电商域表定义（`#trade/server/drizzle/schema` 会 re-export 基座的表） |

## 与基座的协作方式

本层不修改基座代码，全部通过基座预留的扩展点接入：

```ts
// server/plugins/admin-trade.ts
registerSysJobHandlers(tradeJobHandlers)          // 定时任务
registerUserOnboardHook(async (ctx, payload) => {  // 注册/首登后开通会员档案
  await memberService(ctx.db).onboard({ ... })
})
```

顶栏用户菜单里的「钱包 / 商城 / 我的订单」入口也通过 `registerUserMenuItems` 注册，而不是覆盖基座的组件。

## 定制

优先级为 **业务项目 > 本层 > 基座**，因此本层可以覆盖基座的页面（如 `/system/home` 看板），业务项目同样可以覆盖本层的页面。

## 许可

[MIT](./LICENSE)
