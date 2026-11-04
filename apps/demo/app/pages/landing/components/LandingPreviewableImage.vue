<script setup lang="ts">
import LandingImagePreview from './LandingImagePreview.vue'

const props = withDefaults(defineProps<{
  src: string
  alt: string
  title?: string
  imageClass: string
  fallbackClass: string
  fallbackIcon?: string
  fallbackLabel?: string
}>(), {
  fallbackIcon: 'i-lucide-image-off'
})

const failed = ref(false)
const retryToken = ref(0)
const displaySrc = computed(() => retryToken.value > 0 ? `${props.src}?v=${retryToken.value}` : props.src)

function retry() {
  failed.value = false
  retryToken.value += 1
}

watch(() => props.src, () => {
  failed.value = false
  retryToken.value = 0
}, { immediate: true })

onMounted(() => {
  window.addEventListener('focus', retry)
  document.addEventListener('visibilitychange', retry)
})

onBeforeUnmount(() => {
  window.removeEventListener('focus', retry)
  document.removeEventListener('visibilitychange', retry)
})

if (import.meta.hot) {
  import.meta.hot.on('vite:afterUpdate', retry)
}
</script>

<template>
  <LandingImagePreview
    :src="displaySrc"
    :alt="alt"
    :title="title"
  >
    <div class="relative">
      <img
        :key="`${src}-${retryToken}`"
        :src="displaySrc"
        :alt="alt"
        :class="imageClass"
        @load="failed = false"
        @error="failed = true"
      >
      <div
        v-if="failed"
        :class="['absolute inset-0', fallbackClass]"
        @click.stop="retry"
      >
        <UIcon :name="fallbackIcon" class="size-10 text-dimmed" />
        <span v-if="fallbackLabel" class="text-xs text-muted">{{ fallbackLabel }}</span>
      </div>
    </div>
  </LandingImagePreview>
</template>
