<script setup lang="ts">
import { Motion } from 'motion-v'
import LandingGradientGlow from '../components/LandingGradientGlow.vue'
import type { LandingContent } from '../content/types'

const { cta } = defineProps<{
  cta: LandingContent['cta']
}>()

function scrollMotion(delay = 0) {
  return {
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    inViewOptions: { once: true, amount: 0.35 },
    transition: { duration: 0.6, delay }
  }
}
</script>

<template>
  <UPageCTA
    variant="naked"
    :ui="{ root: 'py-20 sm:py-28', container: 'max-w-3xl text-center', title: 'lg:text-5xl whitespace-pre-line', description: 'mx-auto max-w-xl leading-relaxed text-dimmed' }"
  >
    <template #top><LandingGradientGlow class="bottom-0 h-1/2 w-2/3" /></template>
    <template #title><Motion as="span" v-bind="scrollMotion()" class="inline-block">{{ cta.title }}</Motion></template>
    <template #description><Motion as="span" v-bind="scrollMotion(0.1)" class="inline-block">{{ cta.description }}</Motion></template>
    <template #links>
      <Motion class="flex flex-wrap items-center justify-center gap-3" v-bind="scrollMotion(0.18)">
        <UButton v-for="link in cta.links" :key="link.label" v-bind="link" size="xl" />
      </Motion>
    </template>
  </UPageCTA>
</template>
