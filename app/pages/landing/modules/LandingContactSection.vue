<script setup lang="ts">
import { Motion } from 'motion-v'
import LandingPreviewableImage from '../components/LandingPreviewableImage.vue'
import type { LandingContent } from '../content/types'

const { contact } = defineProps<{
  contact: LandingContent['contact']
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
    id="contact"
    :ui="{ root: 'py-20 sm:py-28 scroll-mt-(--ui-header-height)', container: 'max-w-5xl', headline: 'landing-eyebrow', title: 'max-w-2xl mx-auto', description: 'max-w-xl mx-auto text-dimmed' }"
  >
    <template #headline><Motion as="span" v-bind="scrollMotion()" class="inline-block">{{ contact.headline }}</Motion></template>
    <template #title><Motion as="span" v-bind="scrollMotion(0.08)" class="inline-block">{{ contact.title }}</Motion></template>
    <template #description><Motion as="span" v-bind="scrollMotion(0.16)" class="inline-block">{{ contact.description }}</Motion></template>

    <div class="grid items-stretch gap-px overflow-hidden rounded-lg border border-default bg-default sm:grid-cols-2 lg:grid-cols-4">
      <Motion
        v-for="(item, index) in contact.items"
        :key="item.id"
        v-bind="staggerMotion(index)"
        class="h-full"
      >
        <div class="flex h-full min-h-72 flex-col bg-elevated/40 p-6">
          <div class="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <UIcon :name="item.icon" class="size-5" />
          </div>

          <h3 class="mt-5 font-semibold text-highlighted">{{ item.title }}</h3>
          <p class="mt-2 text-sm leading-6 text-muted">{{ item.description }}</p>

          <div class="mt-auto pt-6">
            <UButton
              v-if="item.type === 'link'"
              :label="contact.linkLabel"
              trailing-icon="i-lucide-arrow-up-right"
              color="neutral"
              variant="soft"
              block
              :to="item.to"
              :disabled="item.to === '#'"
            />

            <div
              v-else
              class="overflow-hidden rounded-md border border-default bg-default"
            >
              <LandingPreviewableImage
                v-if="item.image"
                :src="item.image"
                :alt="item.title"
                :title="item.title"
                image-class="aspect-square w-full object-contain p-2 transition duration-300 group-hover:scale-[1.03]"
                fallback-class="flex aspect-square w-full flex-col items-center justify-center gap-3 bg-muted/40 p-4 text-center"
                fallback-icon="i-lucide-qr-code"
                :fallback-label="contact.qrPlaceholder"
              />
              <div
                v-else
                class="flex aspect-square w-full flex-col items-center justify-center gap-3 bg-muted/40 p-4 text-center"
              >
                <UIcon name="i-lucide-qr-code" class="size-10 text-dimmed" />
                <span class="text-xs text-muted">{{ contact.qrPlaceholder }}</span>
              </div>
            </div>
          </div>
        </div>
      </Motion>
    </div>
  </UPageSection>
</template>
