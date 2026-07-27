import { describe, expect, it } from 'vitest'
import { normalizeMenuIcon, normalizeNavigationIcon } from '../app/utils/navigation'

describe('navigation icon normalization', () => {
  it('keeps Nuxt UI icon names unchanged', () => {
    expect(normalizeNavigationIcon('i-lucide-house')).toBe('i-lucide-house')
  })

  it('converts Iconify names to Nuxt UI icon class names', () => {
    expect(normalizeNavigationIcon('lucide:house')).toBe('i-lucide-house')
    expect(normalizeNavigationIcon('icon-park:menu-fold')).toBe('i-icon-park-menu-fold')
  })

  it('converts mixed legacy icon names', () => {
    expect(normalizeNavigationIcon('i-tabler:brand-nuxt')).toBe('i-tabler-brand-nuxt')
  })

  it('falls back to the default menu icon when blank', () => {
    expect(normalizeNavigationIcon('  ')).toBeUndefined()
    expect(normalizeMenuIcon('  ')).toBe('i-lucide-circle')
  })
})
