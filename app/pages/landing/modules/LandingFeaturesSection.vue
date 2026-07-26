<script setup lang="ts">
import { Motion } from 'motion-v'
import type { LandingContent } from '../content/types'

const { features } = defineProps<{
  features: LandingContent['features']
}>()

function scrollMotion(delay = 0) {
  return {
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    inViewOptions: { once: true, amount: 0.35 },
    transition: { duration: 0.6, delay }
  }
}

function staggerMotion(index = 0) {
  return {
    initial: { opacity: 0, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    inViewOptions: { once: true, amount: 0.35 },
    transition: { duration: 0.5, delay: index * 0.07 }
  }
}
</script>

<template>
  <UPageSection
    id="features"
    :ui="{ root: 'py-20 sm:py-28 scroll-mt-(--ui-header-height)', container: 'max-w-6xl', headline: 'landing-eyebrow', title: 'max-w-2xl mx-auto', description: 'max-w-xl mx-auto text-dimmed' }"
  >
    <template #headline><Motion as="span" v-bind="scrollMotion()" class="inline-block">{{ features.headline }}</Motion></template>
    <template #title><Motion as="span" v-bind="scrollMotion(0.08)" class="inline-block">{{ features.title }}</Motion></template>
    <template #description><Motion as="span" v-bind="scrollMotion(0.16)" class="inline-block">{{ features.description }}</Motion></template>

    <div class="overflow-hidden rounded-lg border border-default bg-default">
      <div class="grid grid-cols-1 items-stretch gap-px sm:grid-cols-2 lg:grid-cols-3">
        <Motion
          v-for="(feature, index) in features.items"
          :key="feature.title"
          v-bind="staggerMotion(index)"
          class="h-full"
        >
          <UPageCard
            :icon="feature.icon"
            :title="feature.title"
            :description="feature.description"
            class="h-full min-h-44 rounded-none"
            :ui="{ root: 'h-full', wrapper: 'h-full', leading: 'mb-5 flex size-9 justify-center rounded-md bg-primary/10', title: 'text-base', description: 'text-sm leading-6 text-dimmed' }"
          />
        </Motion>
      </div>
    </div>
  </UPageSection>
</template>
