<script setup lang="ts">
import { Motion } from 'motion-v'
import type { LandingContent } from '@/types/landing/content'

const { faq } = defineProps<{
  faq: LandingContent['faq']
}>()

const faqItems = computed(() => faq.items.map((item, index) => ({
  ...item,
  value: `faq-${index}`
})))

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
  <UPageSection
    id="faq"
    :ui="{ root: 'py-20 sm:py-28 scroll-mt-(--ui-header-height)', container: 'max-w-3xl', headline: 'landing-eyebrow', title: 'max-w-2xl mx-auto', description: 'max-w-xl mx-auto text-dimmed' }"
  >
    <template #headline><Motion as="span" v-bind="scrollMotion()" class="inline-block">{{ faq.headline }}</Motion></template>
    <template #title><Motion as="span" v-bind="scrollMotion(0.08)" class="inline-block">{{ faq.title }}</Motion></template>
    <template #description><Motion as="span" v-bind="scrollMotion(0.16)" class="inline-block">{{ faq.description }}</Motion></template>

    <Motion v-bind="scrollMotion(0.22)">
      <UAccordion
        :items="faqItems"
        type="multiple"
        :ui="{ root: 'border-y border-default', item: 'border-b border-default last:border-b-0', trigger: 'py-5 text-left', body: 'pb-5 text-sm leading-7 text-muted' }"
      />
    </Motion>
  </UPageSection>
</template>
