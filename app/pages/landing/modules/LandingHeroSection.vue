<script setup lang="ts">
import { Motion } from 'motion-v'
import LandingGradientGlow from '../components/LandingGradientGlow.vue'
import LandingHeroShaders from '../components/LandingHeroShaders.client.vue'
import LandingHeroTerminal from '../components/LandingHeroTerminal.vue'
import type { LandingContent } from '@/types/landing/content'

const { page } = defineProps<{
  page: LandingContent
}>()

const heroTitle = computed(() => {
  const [primary = '', ...secondaryParts] = page.hero.title.split('\n')
  return { primary, secondary: secondaryParts.join(' ').trim() }
})

function enterMotion(delay = 0) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
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
  <UPageHero
    :ui="{
      root: 'pb-20 sm:pb-28',
      container: 'relative z-10 lg:py-28',
      wrapper: 'flex flex-col items-center',
      title: 'sm:text-6xl lg:text-7xl xl:text-[76px] leading-[1.06]',
      description: 'mt-5 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed text-default',
      links: 'gap-3'
    }"
  >
    <template #top>
      <Motion v-bind="staggerMotion(0)">
        <LandingHeroShaders class="absolute inset-x-0 top-0 h-full opacity-15" />
      </Motion>
      <LandingGradientGlow class="top-0 h-1/2 w-2/3" />
    </template>

    <template #headline>
      <Motion v-bind="enterMotion(0.15)">
        <UBadge color="neutral" variant="soft" :label="page.hero.headline" class="gap-1.5 rounded-full bg-white/5 px-3 py-1.5 backdrop-blur">
          <template #leading>
            <UChip inset standalone :ui="{ base: 'animate-pulse ring-0' }" />
          </template>
        </UBadge>
      </Motion>
    </template>

    <template #title>
      <Motion as="span" v-bind="enterMotion(0.3)" class="inline-block">
        {{ heroTitle.primary }}
        <br v-if="heroTitle.secondary">
        <span
          v-if="heroTitle.secondary"
          class="landing-shimmer bg-clip-text text-transparent"
          :style="{ backgroundImage: 'linear-gradient(135deg, var(--ui-color-primary-700), var(--ui-color-primary-500), var(--ui-color-primary-300), var(--ui-color-primary-500), var(--ui-color-primary-700))' }"
        >
          {{ heroTitle.secondary }}
        </span>
      </Motion>
    </template>

    <template #description>
      <Motion as="span" v-bind="enterMotion(0.45)" class="inline-block">{{ page.hero.description }}</Motion>
    </template>

    <template #links>
      <Motion class="flex flex-wrap justify-center gap-3" v-bind="enterMotion(0.6)">
        <UButton v-for="link in page.hero.links" :key="link.label" v-bind="link" />
      </Motion>
    </template>

    <Motion as-child v-bind="enterMotion(0.8)" class="mx-auto w-full max-w-2xl">
      <LandingHeroTerminal :title="page.terminal.title" :lines="page.terminal.lines" />
    </Motion>
  </UPageHero>
</template>
