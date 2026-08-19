<script setup lang="ts">
import { Motion } from 'motion-v'
import LandingPreviewableImage from '../components/LandingPreviewableImage.vue'
import type { LandingContent } from '@/types/landing/content'

const { showcase } = defineProps<{
  showcase: LandingContent['showcase']
}>()

const activeShowcase = ref(0)

function scrollMotion(delay = 0) {
  return {
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    inViewOptions: { once: true, amount: 0.35 },
    transition: { duration: 0.6, delay }
  }
}

const activeShowcaseItem = computed(() => showcase.items[activeShowcase.value] ?? showcase.items[0]!)
</script>

<template>
  <UPageSection
    id="showcase"
    :ui="{ root: 'py-20 sm:py-28 scroll-mt-(--ui-header-height)', container: 'max-w-6xl', headline: 'landing-eyebrow', title: 'max-w-2xl mx-auto', description: 'max-w-2xl mx-auto text-dimmed' }"
  >
    <template #headline><Motion as="span" v-bind="scrollMotion()" class="inline-block">{{ showcase.headline }}</Motion></template>
    <template #title><Motion as="span" v-bind="scrollMotion(0.08)" class="inline-block">{{ showcase.title }}</Motion></template>
    <template #description><Motion as="span" v-bind="scrollMotion(0.16)" class="inline-block">{{ showcase.description }}</Motion></template>

    <Motion v-bind="scrollMotion(0.22)" class="space-y-6">
      <div class="flex overflow-x-auto border-b border-default">
        <button
          v-for="(item, index) in showcase.items"
          :key="item.id"
          type="button"
          class="min-w-max border-b-2 px-4 py-3 text-sm font-medium transition-colors"
          :class="activeShowcase === index ? 'border-primary text-highlighted' : 'border-transparent text-muted hover:text-default'"
          @click="activeShowcase = index"
        >
          {{ item.label }}
        </button>
      </div>

      <div class="grid items-center gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.7fr)]">
        <div class="overflow-hidden rounded-lg border border-default bg-elevated shadow-2xl shadow-black/30">
          <LandingPreviewableImage
            :key="activeShowcaseItem.id"
            :src="activeShowcaseItem.image"
            :alt="`${showcase.imageAlt}: ${activeShowcaseItem.label}`"
            :title="activeShowcaseItem.title"
            image-class="aspect-[16/10] w-full object-cover object-top transition duration-300 group-hover:scale-[1.01]"
            fallback-class="flex aspect-[16/10] w-full items-center justify-center bg-muted/50"
            fallback-icon="i-lucide-monitor-up"
          />
        </div>
        <div class="space-y-4">
          <UBadge :label="activeShowcaseItem.label" color="neutral" variant="soft" />
          <h3 class="text-2xl font-semibold text-highlighted sm:text-3xl">{{ activeShowcaseItem.title }}</h3>
          <p class="text-base leading-7 text-muted">{{ activeShowcaseItem.description }}</p>
        </div>
      </div>
    </Motion>
  </UPageSection>
</template>
