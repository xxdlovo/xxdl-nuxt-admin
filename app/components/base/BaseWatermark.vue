<script setup lang="ts">
import type { WatermarkTimeFormat } from '~/stores/theme'

const themeStore = useThemeStore()
const colorMode = useColorMode()
const { user } = useUserSession()

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatWatermarkTime(date: Date, format: WatermarkTimeFormat) {
  const replacements: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds())
  }

  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, token => replacements[token] ?? token)
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

const displayName = computed(() => user.value?.nickname || user.value?.username || '')

const watermarkText = computed(() => {
  const parts: string[] = []

  if (themeStore.general.watermark.currentTimeVisible) {
    parts.push(formatWatermarkTime(now.value, themeStore.general.watermark.timeFormat))
  }

  if (themeStore.general.watermark.userNameVisible && displayName.value) {
    parts.push(displayName.value)
  }

  return parts.join('  ')
})

const watermarkStyle = computed(() => {
  if (!watermarkText.value) {
    return {}
  }

  const fill = colorMode.value === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="360" height="180">
      <text
        x="24"
        y="112"
        transform="rotate(-22 24 112)"
        fill="${fill}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="16"
      >${escapeXml(watermarkText.value)}</text>
    </svg>
  `.trim().replace(/\s+/g, ' ')

  return {
    backgroundImage: `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`,
    backgroundRepeat: 'repeat',
    backgroundSize: '360px 180px'
  }
})

onMounted(() => {
  now.value = new Date()
  timer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<template>
  <div
    v-if="themeStore.general.watermark.visible && watermarkText"
    aria-hidden="true"
    class="pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
    :style="watermarkStyle"
  />
</template>
