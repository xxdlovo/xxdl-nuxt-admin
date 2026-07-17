<script setup lang="ts">
import { resolveColorHex } from '~/composables/themeColorUtils'

const { $t } = useI18n()

const props = defineProps<{
  label: string
  recommendations: string[]
  previewHex?: string
}>()

const color = defineModel<string>({ required: true })

const open = ref(false)
const pickerValue = ref('#FFFFFF')

// 允许用户直接输入 #abc / abc / #aabbcc 这类值，统一转换成标准 HEX。
function normalizeHex(value: string) {
  const trimmed = value.trim()
  const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  const raw = prefixed.slice(1)
  if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) {
    return null
  }

  const normalized = raw.length === 3
    ? raw.split('').map(char => char + char).join('')
    : raw

  return `#${normalized.toUpperCase()}`
}

const currentHex = computed(() => props.previewHex || resolveColorHex(color.value))
const triggerTextColor = computed(() => {
  const value = currentHex.value.replace('#', '')
  if (value.length !== 6) {
    return '#111827'
  }

  const rgb = Number.parseInt(value, 16)
  const r = (rgb >> 16) & 255
  const g = (rgb >> 8) & 255
  const b = rgb & 255
  const luminance = (r * 299 + g * 587 + b * 114) / 1000
  return luminance > 160 ? '#111827' : '#ffffff'
})

watch(open, (value) => {
  if (value) {
    pickerValue.value = currentHex.value
  }
})

watch(currentHex, (value) => {
  if (!open.value) {
    pickerValue.value = value
  }
}, { immediate: true })

watch(pickerValue, (value) => {
  if (open.value) {
    const normalized = normalizeHex(value)
    if (normalized) {
      color.value = normalized
      if (normalized !== value) {
        pickerValue.value = normalized
      }
    }
  }
})

function selectRecommendation(hex: string) {
  color.value = hex
  pickerValue.value = hex
}
</script>

<template>
  <div class="flex items-center justify-between gap-4">
    <div class="min-w-0">
      <p class="text-sm font-medium text-default">
        {{ label }}
      </p>
    </div>

    <UPopover v-model:open="open" :ui="{ content: 'w-80 p-3' }">
      <template #default="{ open: isOpen }">
        <UButton
          size="sm"
          variant="outline"
          class="min-w-40 justify-between gap-3 rounded-md border px-3 py-2 font-mono text-xs transition"
          :class="isOpen ? 'ring-2 ring-primary/20' : ''"
          :style="{
            backgroundColor: currentHex,
            color: triggerTextColor,
            borderColor: currentHex
          }"
        >
          <span class="flex min-w-0 items-center gap-2">
            <span class="size-3 shrink-0 rounded-full border border-white/70" :style="{ backgroundColor: currentHex }" />
            <span class="truncate">
              {{ currentHex.toUpperCase() }}
            </span>
          </span>
          <UIcon name="i-lucide-chevron-down" class="size-4 shrink-0 opacity-80" />
        </UButton>
      </template>

      <template #content>
        <div class="space-y-3">
          <ClientOnly>
            <div class="rounded-lg border border-default bg-elevated/40 p-2">
              <UColorPicker v-model="pickerValue" format="hex" class="w-full" />
            </div>
          </ClientOnly>

          <UInput
            v-model="pickerValue"
            icon="i-lucide-hash"
            size="sm"
            color="neutral"
            variant="outline"
            placeholder="#9A2FA9"
            class="font-mono uppercase"
          />

          <!-- 推荐色只是快捷入口，颜色本身仍然可以通过拖动或 HEX 输入自由修改。 -->
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] font-medium text-muted">
              {{ $t('theme.recommended') }}
            </span>
            <span class="text-[11px] text-muted">
              {{ $t('theme.recommendedDesc') }}
            </span>
          </div>

          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="hex in recommendations"
              :key="hex"
              type="button"
              class="size-7 rounded-sm border border-default shadow-sm transition hover:scale-105"
              :class="currentHex.toUpperCase() === hex.toUpperCase() ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''"
              :style="{ backgroundColor: hex }"
              :title="hex.toUpperCase()"
              @click="selectRecommendation(hex)"
            >
              <span class="sr-only">{{ hex }}</span>
            </button>
          </div>
        </div>
      </template>
    </UPopover>
  </div>
</template>
