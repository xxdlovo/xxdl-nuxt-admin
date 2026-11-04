// BadgeConfig
type BadgeColor = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'

export interface BadgeConfig {
    i18nKey: string
    color: BadgeColor
    icon?: string
}