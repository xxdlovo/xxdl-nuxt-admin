---
title: 文档门户
description: 本站的入口页，按阅读顺序给出各分组入口。
navigation:
  title: 文档首页
---

这是一套全栈 Nuxt 4 后台系统的完整文档：从安装启动、前后端写法，到新增业务模块、错误处理、文件与存储、缓存、定时任务、支付模块、交易模块与端到端支付流程。

::div{.my-8.grid.gap-4.sm:grid-cols-2}
  :::div{.rounded-xl.border.border-default.bg-elevated.p-5}
  ### 快速开始

  项目介绍、安装启动、目录结构与文档站维护规则。

  [进入快速开始 →](/docs/main/getting-started)
  :::

  :::div{.rounded-xl.border.border-default.bg-elevated.p-5}
  ### 前端手册

  页面与布局、tRPC 客户端、表格与 CRUD、权限、国际化、状态与主题。

  [阅读前端手册 →](/docs/main/frontend-handbook/overview)
  :::

  :::div{.rounded-xl.border.border-default.bg-elevated.p-5}
  ### 后端手册

  分层架构、Drizzle 数据层、Repo/Service、tRPC Router、中间件、原生端点。

  [阅读后端手册 →](/docs/main/backend-handbook/overview)
  :::

  :::div{.rounded-xl.border.border-default.bg-elevated.p-5}
  ### 新建模块

  一句话提示词生成整套模块代码，含前后端 14 个步骤与文件清单。

  [开始新建模块 →](/docs/main/new-module)
  :::

  :::div{.rounded-xl.border.border-default.bg-elevated.p-5}
  ### 功能组件

  错误使用、文件使用、缓存使用三大专题。

  [查看功能组件 →](/docs/main/features/error-handling/overview)
  :::

  :::div{.rounded-xl.border.border-default.bg-elevated.p-5}
  ### 定时任务

  Cron 表达式、Handler 编写、到期派发与执行日志。

  [查看定时任务 →](/docs/main/scheduled-jobs/overview)
  :::

  :::div{.rounded-xl.border.border-default.bg-elevated.p-5}
  ### 参考手册

  权限模型、日志体系、字典与系统配置、常见问题。

  [查阅参考手册 →](/docs/main/reference/rbac)
  :::

  :::div{.rounded-xl.border.border-default.bg-elevated.p-5}
  ### 支付模块

  渠道配置与密钥加密、统一下单与状态流转、回调幂等处理，以及虎皮椒适配器与前端支付组件。

  [查看支付模块 →](/docs/main/payment/overview)
  :::

  :::div{.rounded-xl.border.border-default.bg-elevated.p-5}
  ### 交易模块

  商品与服务（含会员等级价、不限库存）、订单资金与履约两个维度、后台管理与会员自助页面。

  [查看交易模块 →](/docs/main/trade/overview)
  :::

  :::div{.rounded-xl.border.border-default.bg-elevated.p-5}
  ### 支付流程

  充值到账、余额支付（冻结→确认）、在线支付三条端到端链路，以及幂等键全景、对账与补偿。

  [查看支付流程 →](/docs/main/payment-flow/overview)
  :::

  :::div{.rounded-xl.border.border-default.bg-elevated.p-5}
  ### 文档站维护

  本站的目录规则、页面写法，以及如何新增分组与页面。

  [查看维护说明 →](/docs/main/getting-started/docs-guide)
  :::
::

## 关于本站

站点由 Nuxt Content 驱动，源文件位于仓库的 `doc/main/` 目录，新增页面的方式见[文档站维护](/docs/main/getting-started/docs-guide)。
