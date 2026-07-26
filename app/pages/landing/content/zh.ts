import type { LandingContent } from './types'

export const landingContentZh = {
  seo: {
    title: 'NuxtAdmin - Nuxt 4 全栈后台管理系统',
    description: '基于 Nuxt 4 的生产级后台基础方案，内置登录认证、RBAC、系统管理、类型安全 API、MySQL、国际化和界面配置。'
  },
  brand: {
    name: 'NuxtAdmin',
    badge: '全栈后台'
  },
  navigation: {
    showcase: '界面预览',
    features: '功能特性',
    stack: '技术栈',
    faq: '常见问题',
    contact: '联系我们'
  },
  actions: {
    source: '源码',
    signIn: '登录',
    enterSystem: '进入系统',
    language: '切换语言',
    appearance: '主题颜色',
    primaryColor: '主色',
    neutralColor: '中性色',
    defaultColor: '默认'
  },
  hero: {
    headline: 'Nuxt 4 全栈后台基础方案',
    title: '专注业务系统。\n基础能力开箱即用。',
    description: '在一个 Nuxt 应用中集成登录认证、RBAC、系统管理、类型安全 API、数据库访问与可配置界面。',
    links: [
      { label: '进入系统', icon: 'i-lucide-log-in', color: 'primary', size: 'xl', to: '/login' },
      { label: '查看界面', trailingIcon: 'i-lucide-arrow-down', size: 'xl', color: 'neutral', variant: 'soft', to: '#showcase' }
    ]
  },
  terminal: {
    title: '本地启动',
    lines: [
      { segments: [{ text: '$ ', style: 'prompt' }, { text: 'pnpm install', style: 'cmd' }] },
      { segments: [{ text: '$ ', style: 'prompt' }, { text: 'pnpm db:push', style: 'cmd' }] },
      { segments: [{ text: '$ ', style: 'prompt' }, { text: 'pnpm seed:admin', style: 'cmd' }] },
      { segments: [{ text: '$ ', style: 'prompt' }, { text: 'pnpm dev', style: 'cmd' }] },
      { segments: [{ text: 'NuxtAdmin 已运行于 ', style: 'success' }, { text: 'http://localhost:3001', style: 'url' }] }
    ]
  },
  showcase: {
    headline: '界面预览',
    title: '不是静态外壳，而是可直接运行的后台系统。',
    description: '从日常管理到权限配置，查看项目中已经实现的真实页面与操作流程。',
    imageAlt: 'NuxtAdmin 系统界面预览',
    items: [
      {
        id: 'dashboard',
        label: '仪表盘',
        title: '登录后立即获得清晰的工作概览',
        description: '统计数据、图表、通知、项目动态与快捷入口，为业务后台提供实用的首页起点。',
        image: '/images/landing/dashboard.png'
      },
      {
        id: 'users',
        label: '用户管理',
        title: '高效处理用户与组织数据',
        description: '通过一致的交互完成搜索、分页、编辑、角色分配和部门数据管理。',
        image: '/images/landing/users.png'
      },
      {
        id: 'roles',
        label: '角色权限',
        title: '看得见、配得清的 RBAC',
        description: '集中配置角色数据范围、菜单访问、路由访问与按钮级权限。',
        image: '/images/landing/roles.png'
      },
      {
        id: 'menus',
        label: '菜单管理',
        title: '让路由、导航与权限保持一致',
        description: '管理树形菜单、路由元数据、图标、显示状态、排序和权限标识。',
        image: '/images/landing/menus.png'
      }
    ]
  },
  features: {
    headline: '核心能力',
    title: '后台系统的常用能力已经完整串联。',
    description: '直接复用现有模块，把开发精力留给真正属于业务的部分。',
    items: [
      { icon: 'i-lucide-shield-check', title: '登录认证与会话', description: '用户名密码登录、服务端会话与受保护路由共同保障系统访问。' },
      { icon: 'i-lucide-key-round', title: '完整 RBAC', description: '用户、角色、菜单、数据范围、路由和按钮权限使用统一模型。' },
      { icon: 'i-lucide-settings-2', title: '系统管理', description: '内置部门、字典、通知、登录日志、系统日志与常用 CRUD 流程。' },
      { icon: 'i-lucide-cloud-upload', title: 'OSS 与文件', description: '管理存储配置、校验连接、上传文件并维护文件记录。' },
      { icon: 'i-lucide-languages', title: '多语言支持', description: '提供可持久化的语言切换与可扩展内容结构，便于继续增加其他语言。' },
      { icon: 'i-lucide-palette', title: '可配置界面', description: '支持明暗主题、主题色、布局、圆角、标签页、页脚与水印设置。' }
    ]
  },
  stack: {
    headline: '技术方案',
    title: '现代、类型安全的 Nuxt 全栈技术栈。',
    description: '前端、服务端 API、数据校验与数据库访问集中在同一工程，同时保留清晰边界。',
    items: [
      { icon: 'i-simple-icons-nuxtdotjs', name: 'Nuxt 4', description: 'Vue 全栈框架与应用运行时' },
      { icon: 'i-simple-icons-vuedotjs', name: 'Vue 3', description: 'Composition API 与响应式界面层' },
      { icon: 'i-simple-icons-tailwindcss', name: 'Nuxt UI 4', description: '无障碍组件与 Tailwind CSS 4' },
      { icon: 'i-lucide-braces', name: 'tRPC + Zod', description: '共享契约与端到端类型安全' },
      { icon: 'i-simple-icons-drizzle', name: 'Drizzle ORM', description: '类型化数据库结构与访问层' },
      { icon: 'i-simple-icons-mysql', name: 'MySQL', description: '稳定可靠的关系型数据存储' }
    ]
  },
  quickStart: {
    headline: '快速开始',
    title: '四条命令，从克隆项目到进入系统。',
    description: '先在环境文件中配置数据库与管理员密码，然后初始化并运行项目。',
    copy: '复制命令',
    copied: '已复制',
    steps: [
      { command: 'pnpm install', description: '安装项目依赖' },
      { command: 'pnpm db:push', description: '同步数据库结构' },
      { command: 'pnpm seed:admin', description: '创建管理员账号' },
      { command: 'pnpm dev', description: '启动开发服务器' }
    ]
  },
  faq: {
    headline: 'FAQ',
    title: '开始之前，你可能关心这些问题。',
    description: '关于 NuxtAdmin 的运行、扩展、权限、部署和国际化。',
    items: [
      { label: '项目需要什么运行环境？', content: '推荐使用 Node.js 22。项目使用 pnpm 和 MySQL 数据库，初始化数据库结构前需要先配置必要的环境变量。' },
      { label: '权限控制是如何实现的？', content: 'RBAC 模型串联用户、角色、菜单、数据范围、路由和按钮权限码，服务端过程与客户端操作都可以进行权限校验。' },
      { label: '可以更换其他数据库吗？', content: '当前数据库结构与仓储层通过 Drizzle ORM 面向 MySQL 实现。更换数据库需要调整 Drizzle 驱动、部分结构定义和数据库配置。' },
      { label: '适合进行二次开发吗？', content: '适合。共享 DTO、通用 CRUD 组件、tRPC 路由与项目中的模块开发规范，可以帮助新增业务模块保持一致。' },
      { label: '项目应该如何部署？', content: '按照标准 Nuxt 应用完成构建，将生成的 Nitro 服务部署到可运行 Node.js 的环境，并确保能够访问 MySQL 与对象存储服务。' },
      { label: '国际化内容如何组织？', content: '后台系统使用 nuxt-i18n-micro 和可扩展的语言配置。落地页文案独立存放在带类型约束的本地内容文件中，增加其他语言时无需扩大全局翻译字典。' }
    ]
  },
  contact: {
    headline: '联系我们',
    title: '关注项目动态，加入交流社区。',
    description: '你可以通过群组、Twitter / X、微信或 QQ 与项目取得联系。',
    linkLabel: '打开渠道',
    qrPlaceholder: '二维码待补充',
    items: [
      {
        id: 'group',
        icon: 'i-lucide-users-round',
        title: '交流群组',
        description: '加入开发者群组，交流项目使用、问题反馈与实现思路。',
        type: 'link',
        to: '#'
      },
      {
        id: 'twitter',
        icon: 'i-simple-icons-x',
        title: 'Twitter / X',
        description: '关注项目进展、版本动态与 Nuxt 相关开发内容。',
        type: 'link',
        to: '#'
      },
      {
        id: 'wechat',
        icon: 'i-simple-icons-wechat',
        title: '微信',
        description: '扫描二维码，通过微信联系或加入交流群。',
        type: 'qr',
        image: '/images/landing/contact/wechat.png'
      },
      {
        id: 'qq',
        icon: 'i-simple-icons-tencentqq',
        title: 'QQ',
        description: '扫描二维码，通过 QQ 联系或加入交流群。',
        type: 'qr',
        image: '/images/landing/contact/qq.png'
      }
    ]
  },
  cta: {
    title: '从已经解决的系统能力开始。',
    description: '进入 NuxtAdmin，体验现有流程，再将它塑造成你的下一套业务系统。',
    links: [
      { label: '进入系统', icon: 'i-lucide-log-in', color: 'primary', to: '/login' },
      { label: '查看源码', icon: 'i-simple-icons-github', color: 'neutral', variant: 'soft', to: '#' }
    ]
  },
  footer: {
    description: '面向真实业务系统的 Nuxt 4 全栈后台基础方案。',
    links: [
      { label: '界面预览', to: '#showcase' },
      { label: '功能特性', to: '#features' },
      { label: '技术栈', to: '#stack' },
      { label: '常见问题', to: '#faq' },
      { label: '联系我们', to: '#contact' }
    ],
    copyright: '基于 Nuxt 与 Nuxt UI 构建。'
  }
} satisfies LandingContent
