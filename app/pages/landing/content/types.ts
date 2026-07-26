export type LandingLocale = 'en' | 'zh'

export interface LandingLink {
  label: string
  to: string
  icon?: string
  trailingIcon?: string
  color?: 'primary' | 'neutral'
  variant?: 'solid' | 'soft' | 'subtle' | 'outline' | 'ghost'
  size?: 'xl'
}

export interface TerminalSegment {
  text: string
  style: 'prompt' | 'cmd' | 'flag' | 'dim' | 'success' | 'url'
}

export interface LandingContent {
  seo: {
    title: string
    description: string
  }
  brand: {
    name: string
    badge: string
  }
  navigation: {
    showcase: string
    features: string
    stack: string
    faq: string
    contact: string
  }
  actions: {
    source: string
    signIn: string
    enterSystem: string
    language: string
    appearance: string
    primaryColor: string
    neutralColor: string
    defaultColor: string
  }
  hero: {
    headline: string
    title: string
    description: string
    links: LandingLink[]
  }
  terminal: {
    title: string
    lines: Array<{ segments: TerminalSegment[] }>
  }
  showcase: {
    headline: string
    title: string
    description: string
    imageAlt: string
    items: Array<{
      id: 'dashboard' | 'users' | 'roles' | 'menus'
      label: string
      title: string
      description: string
      image: string
    }>
  }
  features: {
    headline: string
    title: string
    description: string
    items: Array<{
      icon: string
      title: string
      description: string
    }>
  }
  stack: {
    headline: string
    title: string
    description: string
    items: Array<{
      icon: string
      name: string
      description: string
    }>
  }
  quickStart: {
    headline: string
    title: string
    description: string
    copy: string
    copied: string
    steps: Array<{
      command: string
      description: string
    }>
  }
  faq: {
    headline: string
    title: string
    description: string
    items: Array<{
      label: string
      content: string
    }>
  }
  contact: {
    headline: string
    title: string
    description: string
    linkLabel: string
    qrPlaceholder: string
    items: Array<{
      id: 'group' | 'twitter' | 'wechat' | 'qq'
      icon: string
      title: string
      description: string
      type: 'link' | 'qr'
      to?: string
      image?: string
    }>
  }
  cta: {
    title: string
    description: string
    links: LandingLink[]
  }
  footer: {
    description: string
    links: Array<{
      label: string
      to: string
    }>
    copyright: string
  }
}
