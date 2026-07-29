import type { LandingContent } from './types'

export const landingContentEn = {
  seo: {
    title: 'NuxtAdmin - Full-stack Nuxt 4 Admin Starter',
    description: 'A production-ready Nuxt 4 admin foundation with authentication, RBAC, system modules, type-safe APIs, MySQL, i18n, and configurable themes.'
  },
  brand: {
    name: 'NuxtAdmin',
    badge: 'Full stack'
  },
  navigation: {
    showcase: 'Showcase',
    features: 'Features',
    stack: 'Tech stack',
    faq: 'FAQ',
    contact: 'Contact'
  },
  actions: {
    source: 'Source',
    signIn: 'Sign in',
    enterSystem: 'Enter system',
    language: 'Language',
    appearance: 'Theme colors',
    primaryColor: 'Primary',
    neutralColor: 'Neutral',
    defaultColor: 'Default'
  },
  hero: {
    headline: 'Nuxt 4 full-stack admin foundation',
    title: 'Build business systems.\nSkip the foundation work.',
    description: 'Authentication, RBAC, system management, type-safe APIs, database access, code generation guidance, and demo read-only protection in one Nuxt application.',
    links: [
      { label: 'Demo address 1', icon: 'i-lucide-log-in', color: 'primary', size: 'xl', to: '#' },
      { label: 'Demo address 2', trailingIcon: 'i-lucide-arrow-up-right', size: 'xl', color: 'neutral', variant: 'soft', to: '#' }
    ]
  },
  terminal: {
    title: 'Start locally',
    lines: [
      { segments: [{ text: '$ ', style: 'prompt' }, { text: 'pnpm install', style: 'cmd' }] },
      { segments: [{ text: '$ ', style: 'prompt' }, { text: 'mysql -u <user> -p <database> < doc/mysql-ddl.sql', style: 'cmd' }] },
      { segments: [{ text: '$ ', style: 'prompt' }, { text: 'mysql -u <user> -p <database> < doc/init.sql', style: 'cmd' }] },
      { segments: [{ text: '$ ', style: 'prompt' }, { text: 'pnpm dev', style: 'cmd' }] },
      { segments: [{ text: 'Demo account ', style: 'success' }, { text: 'admin / adminadmin', style: 'url' }] }
    ]
  },
  showcase: {
    headline: 'Interface preview',
    title: 'A working admin system, not a static shell.',
    description: 'Explore real screens already implemented in the project, from daily operations to permission configuration.',
    imageAlt: 'NuxtAdmin interface preview',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        title: 'A useful overview from the first login',
        description: 'Statistics, charts, notices, project activity, and shortcuts give teams a practical starting point.',
        image: '/images/dashboard.png'
      },
      {
        id: 'users',
        label: 'Users',
        title: 'Efficient user and department operations',
        description: 'Search, paginate, edit, assign roles, and manage organizational data through consistent workflows.',
        image: '/images/users_manager.png'
      },
      {
        id: 'roles',
        label: 'Roles & permissions',
        title: 'RBAC that is visible and manageable',
        description: 'Configure role data scopes, menu access, route access, and button-level permissions.',
        image: '/images/role_manager.png'
      },
      {
        id: 'menus',
        label: 'Menus',
        title: 'Routes, navigation, and permissions stay aligned',
        description: 'Manage hierarchical menus, route metadata, icons, visibility, ordering, and permission identifiers.',
        image: '/images/menu_list.png'
      }
    ]
  },
  features: {
    headline: 'Core capabilities',
    title: 'The common admin work is already connected.',
    description: 'Use the existing modules as a foundation, then focus engineering effort on your actual business.',
    items: [
      { icon: 'i-lucide-shield-check', title: 'Authentication & sessions', description: 'Username and password login backed by server-side sessions and protected routes.' },
      { icon: 'i-lucide-key-round', title: 'Complete RBAC', description: 'Users, roles, menus, data scopes, routes, and button permissions work as one model.' },
      { icon: 'i-lucide-settings-2', title: 'System management', description: 'Departments, dictionaries, notices, login logs, system logs, and common CRUD workflows.' },
      { icon: 'i-lucide-cloud-upload', title: 'OSS & files', description: 'Manage storage configurations, validate connections, upload files, and maintain file records.' },
      { icon: 'i-lucide-languages', title: 'Multilingual support', description: 'A persistent locale switcher and extensible content structure make additional languages straightforward to add.' },
      { icon: 'i-lucide-palette', title: 'Configurable interface', description: 'Dark mode, theme colors, layout modes, radius, tabs, footer, and watermark settings.' }
    ]
  },
  stack: {
    headline: 'Technology',
    title: 'A modern, type-safe Nuxt stack.',
    description: 'The frontend, server API, validation, and database layer live together without giving up clear boundaries.',
    items: [
      { icon: 'i-simple-icons-nuxtdotjs', name: 'Nuxt 4', description: 'Vue full-stack framework and application runtime' },
      { icon: 'i-simple-icons-vuedotjs', name: 'Vue 3', description: 'Composition API and reactive interface layer' },
      { icon: 'i-simple-icons-tailwindcss', name: 'Nuxt UI 4', description: 'Accessible components with Tailwind CSS 4' },
      { icon: 'i-lucide-braces', name: 'tRPC + Zod', description: 'Shared contracts and end-to-end type safety' },
      { icon: 'i-simple-icons-drizzle', name: 'Drizzle ORM', description: 'Typed schema and data access layer' },
      { icon: 'i-simple-icons-mysql', name: 'MySQL', description: 'Reliable relational data storage' }
    ]
  },
  quickStart: {
    headline: 'Quick start',
    title: 'Initialize the database, then enter the system.',
    description: 'Configure the environment file, run the DDL and initialization SQL scripts, then start the Nuxt development server.',
    copy: 'Copy command',
    copied: 'Copied',
    steps: [
      { command: 'pnpm install', description: 'Install project dependencies' },
      { command: 'mysql -u <user> -p <database> < doc/mysql-ddl.sql', description: 'Create the database tables' },
      { command: 'mysql -u <user> -p <database> < doc/init.sql', description: 'Initialize menus, permissions, and the administrator account' },
      { command: 'pnpm dev', description: 'Start the development server' }
    ]
  },
  faq: {
    headline: 'FAQ',
    title: 'Questions before you start.',
    description: 'A few practical details about running, extending, and deploying NuxtAdmin.',
    items: [
      { label: 'What environment does the project require?', content: 'Node.js 22 is recommended. The project uses pnpm and a MySQL database. Configure the required environment variables before initializing the schema.' },
      { label: 'How does permission control work?', content: 'The RBAC model connects users, roles, menus, data scopes, routes, and button permission codes. Both server procedures and client actions can enforce permissions.' },
      { label: 'Can I use another database?', content: 'The current schema and repository layer target MySQL through Drizzle ORM. Supporting another database requires adapting the Drizzle driver, schema details, and database configuration.' },
      { label: 'Is it suitable for secondary development?', content: 'Yes. Shared DTOs, reusable CRUD components, tRPC routers, and the code generation guide in doc/code-gen.md are designed to make business modules consistent to extend.' },
      { label: 'Can I modify data in the demo?', content: 'The demo account is admin / adminadmin. The demo environment is protected, so edit and delete operations are blocked.' },
      { label: 'How can it be deployed?', content: 'Build it as a standard Nuxt application and deploy the generated Nitro server to a Node-compatible environment with access to your MySQL and storage services.' },
      { label: 'How is internationalization organized?', content: 'The admin system uses nuxt-i18n-micro with an extensible locale configuration. Landing-page copy is kept in local typed content files so additional languages can be added without expanding the global translation dictionary.' }
    ]
  },
  contact: {
    headline: 'Contact',
    title: 'Connect with the project and community.',
    description: 'Follow updates, join discussions, or scan a QR code to get in touch through your preferred channel.',
    linkLabel: 'Open channel',
    qrPlaceholder: 'QR code coming soon',
    items: [
      {
        id: 'group',
        icon: 'i-selfhst:reddit',
        title: 'Community group',
        description: 'Join the reddit group for project discussion, feedback, and implementation ideas.',
        type: 'link',
        to: 'https://www.reddit.com/r/xxdl/'
      },
      {
        id: 'twitter',
        icon: 'i-simple-icons-x',
        title: 'Twitter / X',
        description: 'Follow project progress, release notes, and related Nuxt development updates.',
        type: 'link',
        to: '#'
      },
      {
        id: 'wechat',
        icon: 'i-simple-icons-wechat',
        title: 'WeChat',
        description: 'Scan the QR code to connect through WeChat.',
        type: 'qr',
        image: '/images/landing/contact/wechat.png'
      },
      {
        id: 'qq',
        icon: 'i-simple-icons-tencentqq',
        title: 'QQ',
        description: 'Scan the QR code to join or contact through QQ.',
        type: 'qr',
        image: '/images/landing/contact/qq.png'
      }
    ]
  },
  cta: {
    title: 'Try the demo, then build your own module.',
    description: 'Log in with admin / adminadmin, inspect the workflows, and use doc/code-gen.md to extend the system consistently.',
    links: [
      { label: 'Demo address 1', icon: 'i-lucide-log-in', color: 'primary', to: '#' },
      { label: 'Demo address 2', icon: 'i-lucide-arrow-up-right', color: 'neutral', variant: 'soft', to: '#' }
    ]
  },
  footer: {
    description: 'A full-stack Nuxt 4 admin foundation for real business systems.',
    links: [
      { label: 'Showcase', to: '#showcase' },
      { label: 'Features', to: '#features' },
      { label: 'Tech stack', to: '#stack' },
      { label: 'FAQ', to: '#faq' },
      { label: 'Contact', to: '#contact' }
    ],
    copyright: 'Built with Nuxt and Nuxt UI.'
  }
} satisfies LandingContent
