import colors from 'tailwindcss/colors'

export type ThemeColorKey = 'primary' | 'info' | 'success' | 'warning' | 'error' | 'neutral'

export const themeColorKeys: ThemeColorKey[] = ['primary', 'info', 'success', 'warning', 'error', 'neutral']
export const neutralColorNames = ['slate', 'gray', 'zinc', 'neutral', 'stone']
export const themePaletteNames = Object.keys(
  Object.fromEntries(
    Object.entries(colors).filter(([key]) => !['inherit', 'current', 'transparent', 'black', 'white', ...neutralColorNames].includes(key))
  )
)

function hexToRgb(hex: string) {
  const value = hex.replace('#', '').trim()
  if (![3, 6].includes(value.length)) {
    return null
  }

  const normalized = value.length === 3
    ? value.split('').map(char => char + char).join('')
    : value

  const parsed = Number.parseInt(normalized, 16)
  if (Number.isNaN(parsed)) {
    return null
  }

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255
  }
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map(value => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0')).join('')}`
}

function mixHex(left: string, right: string, ratio: number) {
  const a = hexToRgb(left)
  const b = hexToRgb(right)
  if (!a || !b) {
    return left
  }

  return rgbToHex(
    a.r + (b.r - a.r) * ratio,
    a.g + (b.g - a.g) * ratio,
    a.b + (b.b - a.b) * ratio
  )
}

function convertOklchToHex(input: string) {
  const match = input.match(/^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/i)
  if (!match) {
    return input
  }

  const l = Number(match[1]) / 100
  const c = Number(match[2])
  const h = Number(match[3]) * Math.PI / 180

  const a = c * Math.cos(h)
  const b = c * Math.sin(h)

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b

  const l3 = l_ ** 3
  const m3 = m_ ** 3
  const s3 = s_ ** 3

  const compand = (value: number) => {
    const clamped = Math.min(Math.max(value, 0), 1)
    return clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * (clamped ** (1 / 2.4)) - 0.055
  }

  const r = compand(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3)
  const g = compand(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3)
  const bl = compand(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3)

  return rgbToHex(r * 255, g * 255, bl * 255)
}

function getPaletteColor(name: string) {
  const palette = (colors as Record<string, any>)[name]
  if (typeof palette === 'string') {
    return palette
  }
  return palette?.[500] || palette?.[400] || palette?.[600] || '#FFFFFF'
}

export function resolveColorHex(value: string) {
  if (!value) {
    return '#FFFFFF'
  }

  if (value.startsWith('#')) {
    return value
  }

  if (value.startsWith('oklch(')) {
    return convertOklchToHex(value)
  }

  return convertOklchToHex(getPaletteColor(value))
}

export function resolveThemeShadeScale(baseHex: string) {
  const white = '#FFFFFF'
  const black = '#000000'

  return {
    50: mixHex(baseHex, white, 0.92),
    100: mixHex(baseHex, white, 0.84),
    200: mixHex(baseHex, white, 0.68),
    300: mixHex(baseHex, white, 0.52),
    400: mixHex(baseHex, white, 0.34),
    500: baseHex,
    600: mixHex(baseHex, black, 0.15),
    700: mixHex(baseHex, black, 0.3),
    800: mixHex(baseHex, black, 0.45),
    900: mixHex(baseHex, black, 0.6),
    950: mixHex(baseHex, black, 0.75)
  } as const
}

export function buildThemeColorStyles(colorsMap: Record<ThemeColorKey, string>) {
  return themeColorKeys.map((key) => {
    const shades = resolveThemeShadeScale(colorsMap[key])
    return Object.entries(shades)
      .map(([shade, hex]) => `--ui-color-${key}-${shade}: ${hex};`)
      .join('\n  ')
  }).join('\n  ')
}

export function applyThemeColorStyles(colorsMap: Record<ThemeColorKey, string>) {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement.style

  for (const key of themeColorKeys) {
    const shades = resolveThemeShadeScale(colorsMap[key])
    for (const [shade, hex] of Object.entries(shades)) {
      root.setProperty(`--ui-color-${key}-${shade}`, hex)
    }

    root.setProperty(`--ui-${key}`, shades[500])
  }
}
