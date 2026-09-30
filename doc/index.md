---
title: Nuxt Content 演示文档
description: 一个用于测试内容查询、Markdown 渲染和文档跳转的示例主页。
navigation:
  title: 文档首页
---

# Nuxt Content 演示文档

这是一个轻量的测试主页，用来演示 Markdown 内容、层级目录和页面跳转。上方导航可以前往文档、落地页或后台，下面的卡片可以继续打开几个测试页面。

::div{.my-8.grid.gap-4.sm:grid-cols-3}
  :::div{.rounded-xl.border.border-default.bg-elevated.p-5}
  ### 快速开始

  了解最基础的安装与查询流程。

  [打开安装示例 →](/docs/getting-started/installation)
  :::

  :::div{.rounded-xl.border.border-default.bg-elevated.p-5}
  ### 页面结构

  查看文档目录如何组织 Markdown 文件。

  [查看结构示例 →](/docs/getting-started/structure)
  :::

  :::div{.rounded-xl.border.border-default.bg-elevated.p-5}
  ### 组件演示

  浏览一页包含代码和提示块的测试内容。

  [查看组件示例 →](/docs/examples/components)
  :::
::

## 这只是测试数据

这里的文字和链接仅用于验证内容模块是否能够读取 Markdown、生成路由并正常渲染。你可以继续在 `doc/` 目录添加文件，文件路径会自动对应到 `/docs/` 下的页面。
