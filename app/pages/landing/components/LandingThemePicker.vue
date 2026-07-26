<script setup lang="ts">
import { neutralColorNames, resolveColorHex } from '~/composables/themeColorUtils'

defineProps<{
  label: string
  primaryLabel: string
  neutralLabel: string
  defaultLabel: string
}>()

const appConfig = useAppConfig()
const {
  getThemeColor,
  resetThemeColor,
  setThemeColor
} = useThemeColors()

const primaryNames = ['green', 'lime', 'emerald', 'blue', 'indigo', 'violet', 'rose']
const primaryOptions = primaryNames.map(name => ({
  name,
  hex: resolveColorHex(name)
}))
const neutralOptions = neutralColorNames.map(name => ({
  name,
  hex: resolveColorHex(name)
}))

const primary = computed({
  get: () => getThemeColor('primary'),
  set: value => setThemeColor('primary', value)
})
const neutral = computed({
  get: () => getThemeColor('neutral'),
  set: value => setThemeColor('neutral', value)
})
const primaryIsDefault = computed(() => !appConfig.theme.colors?.primary)
const neutralIsDefault = computed(() => !appConfig.theme.colors?.neutral)

function isSelected(current: string, value: string) {
  return current.toUpperCase() === value.toUpperCase()
}
</script>

<template>
  <UPopover :ui="{ content: 'w-80 p-4' }">
    <UTooltip :text="label" :delay-duration="0">
      <UButton
        icon="i-lucide-palette"
        color="neutral"
        variant="ghost"
        :aria-label="label"
      />
    </UTooltip>

    <template #content>
      <div class="space-y-5">
        <div class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium text-default">{{ primaryLabel }}</p>
            <UButton
              :label="defaultLabel"
              icon="i-lucide-rotate-ccw"
              color="neutral"
              :variant="primaryIsDefault ? 'soft' : 'ghost'"
              size="xs"
              @click="resetThemeColor('primary')"
            />
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="option in primaryOptions"
              :key="option.name"
              type="button"
              class="flex size-8 items-center justify-center rounded-md border border-default transition hover:scale-105"
              :class="isSelected(primary, option.hex) && !primaryIsDefault ? 'ring-2 ring-primary ring-offset-2 ring-offset-default' : ''"
              :style="{ backgroundColor: option.hex }"
              :title="option.name"
              @click="primary = option.hex"
            >
              <UIcon
                v-if="isSelected(primary, option.hex) && !primaryIsDefault"
                name="i-lucide-check"
                class="size-4 text-white drop-shadow"
              />
            </button>
          </div>
          <ClientOnly>
            <UColorPicker v-model="primary" format="hex" class="w-full" />
          </ClientOnly>
        </div>

        <USeparator />

        <div class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium text-default">{{ neutralLabel }}</p>
            <UButton
              :label="defaultLabel"
              icon="i-lucide-rotate-ccw"
              color="neutral"
              :variant="neutralIsDefault ? 'soft' : 'ghost'"
              size="xs"
              @click="resetThemeColor('neutral')"
            />
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="option in neutralOptions"
              :key="option.name"
              type="button"
              class="flex size-8 items-center justify-center rounded-md border border-default transition hover:scale-105"
              :class="isSelected(neutral, option.hex) && !neutralIsDefault ? 'ring-2 ring-primary ring-offset-2 ring-offset-default' : ''"
              :style="{ backgroundColor: option.hex }"
              :title="option.name"
              @click="neutral = option.hex"
            >
              <UIcon
                v-if="isSelected(neutral, option.hex) && !neutralIsDefault"
                name="i-lucide-check"
                class="size-4 text-white drop-shadow"
              />
            </button>
          </div>
        </div>

        <div class="rounded-md border border-default bg-muted/40 px-3 py-2 font-mono text-xs text-muted">
          {{ primary.toUpperCase() }} / {{ neutral.toUpperCase() }}
        </div>
      </div>
    </template>
  </UPopover>
</template>
