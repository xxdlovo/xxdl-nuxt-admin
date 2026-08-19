<script setup lang="ts">
import { Motion } from 'motion-v'
import type { LandingContent } from '@/types/landing/content'

const { stack } = defineProps<{
  stack: LandingContent['stack']
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
    id="stack"
    :ui="{ root: 'py-20 sm:py-28 scroll-mt-(--ui-header-height)', container: 'max-w-6xl', headline: 'landing-eyebrow', title: 'max-w-2xl mx-auto', description: 'max-w-xl mx-auto text-dimmed' }"
  >
    <template #headline><Motion as="span" v-bind="scrollMotion()" class="inline-block">{{ stack.headline }}</Motion></template>
    <template #title><Motion as="span" v-bind="scrollMotion(0.08)" class="inline-block">{{ stack.title }}</Motion></template>
    <template #description><Motion as="span" v-bind="scrollMotion(0.16)" class="inline-block">{{ stack.description }}</Motion></template>

    <div class="grid gap-px overflow-hidden rounded-lg border border-default bg-default sm:grid-cols-2 lg:grid-cols-3">
      <Motion
        v-for="(technology, index) in stack.items"
        :key="technology.name"
        v-bind="staggerMotion(index)"
        class="flex min-h-32 items-start gap-4 bg-elevated/40 p-6"
      >
        <div class="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <UIcon :name="technology.icon" class="size-5" />
        </div>
        <div>
          <h3 class="font-semibold text-highlighted">{{ technology.name }}</h3>
          <p class="mt-1 text-sm leading-6 text-muted">{{ technology.description }}</p>
        </div>
      </Motion>
    </div>
  </UPageSection>
</template>
