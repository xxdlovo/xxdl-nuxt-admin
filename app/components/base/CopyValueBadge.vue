<script setup lang="ts">
import { useToastSuccess } from '~/utils/toast'
import { copyToClipboard } from '~/utils/clipboard'

type BadgeColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'

const props = withDefaults(defineProps<{
  label: string
  value?: string | number | null
  color?: BadgeColor
  icon?: string
}>(), {
  value: null,
  color: 'primary',
  icon: 'i-lucide-hash',
})

const { $ts } = useI18n()
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

const hasValue = computed(() =>
  props.value !== null && props.value !== undefined && props.value !== ''
)

const textValue = computed(() => hasValue.value ? String(props.value) : '')

function stopEvent() {}

async function handleCopy() {
  if (!hasValue.value) return

  const succeeded = await copyToClipboard(textValue.value)

  if (!succeeded) {
    return
  }

  copied.value = true
  useToastSuccess($ts('common.copySuccess'))

  if (copiedTimer) {
    clearTimeout(copiedTimer)
  }
  copiedTimer = setTimeout(() => {
    copied.value = false
    copiedTimer = null
  }, 1600)
}

onUnmounted(() => {
  if (copiedTimer) {
    clearTimeout(copiedTimer)
  }
})
</script>

<template>
  <span
    v-if="hasValue"
    class="inline-flex max-w-full items-center overflow-hidden rounded-full"
    :title="`${label} ${textValue}`"
    @click.stop="stopEvent"
  >
    <UBadge
      :color="color"
      variant="subtle"
      :icon="icon"
      class="min-w-0 rounded-r-none rounded-l-full"
    >
      <span class="truncate">{{ label }} {{ textValue }}</span>
    </UBadge>
    <UButton
      type="button"
      :color="color"
      variant="soft"
      size="xs"
      square
      :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
      class="rounded-l-none rounded-r-full"
      :aria-label="$ts('common.copy')"
      :title="$ts('common.copy')"
      @click.stop="handleCopy"
    />
  </span>
</template>
