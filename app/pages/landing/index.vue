<script setup lang="ts">
import LandingContactSection from './modules/LandingContactSection.vue'
import LandingCtaSection from './modules/LandingCtaSection.vue'
import LandingFaqSection from './modules/LandingFaqSection.vue'
import LandingFeaturesSection from './modules/LandingFeaturesSection.vue'
import LandingHeroSection from './modules/LandingHeroSection.vue'
import LandingQuickStartSection from './modules/LandingQuickStartSection.vue'
import LandingShowcaseSection from './modules/LandingShowcaseSection.vue'
import LandingStackSection from './modules/LandingStackSection.vue'
import { useLandingLocale } from './useLandingLocale'

definePageMeta({
  alias: '/',
  layout: 'landing'
})

const { content: page, locale } = useLandingLocale()

useSeoMeta({
  title: () => page.value.seo.title,
  ogTitle: () => page.value.seo.title,
  description: () => page.value.seo.description,
  ogDescription: () => page.value.seo.description,
  twitterCard: 'summary_large_image'
})

useHead({
  htmlAttrs: {
    lang: () => locale.value === 'zh' ? 'zh-CN' : 'en'
  },
  script: [
    {
      key: 'la-collect',
      id: 'LA_COLLECT',
      src: 'https://sdk.51.la/js-sdk-pro.min.js'
    },
    {
      key: 'la-init',
      innerHTML: 'window.LA && window.LA.init({ id: "3QgZUAv8LBLeVflg", ck: "3QgZUAv8LBLeVflg" })'
    }
  ]
})
</script>

<template>
  <div>
    <LandingHeroSection :page="page" />
    <LandingShowcaseSection :showcase="page.showcase" />
    <LandingFeaturesSection :features="page.features" />
    <LandingStackSection :stack="page.stack" />
    <LandingQuickStartSection :quick-start="page.quickStart" />
    <LandingFaqSection :faq="page.faq" />
    <LandingContactSection :contact="page.contact" />
    <LandingCtaSection :cta="page.cta" />
  </div>
</template>
