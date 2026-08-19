<script setup lang="ts">
import { Motion } from 'motion-v'
import type { LandingContent } from '@/types/landing/content'

const { quickStart } = defineProps<{
  quickStart: LandingContent['quickStart']
}>()

const copiedCommand = ref<string>()

async function copyCommand(command: string) {
  await navigator.clipboard.writeText(command)
  copiedCommand.value = command
  window.setTimeout(() => {
    if (copiedCommand.value === command) {
      copiedCommand.value = undefined
    }
  }, 2000)
}

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
    :ui="{ root: 'py-20 sm:py-28', container: 'max-w-5xl', headline: 'landing-eyebrow', title: 'max-w-2xl mx-auto', description: 'max-w-xl mx-auto text-dimmed' }"
  >
    <template #headline><Motion as="span" v-bind="scrollMotion()" class="inline-block">{{ quickStart.headline }}</Motion></template>
    <template #title><Motion as="span" v-bind="scrollMotion(0.08)" class="inline-block">{{ quickStart.title }}</Motion></template>
    <template #description><Motion as="span" v-bind="scrollMotion(0.16)" class="inline-block">{{ quickStart.description }}</Motion></template>

    <Motion v-bind="scrollMotion(0.22)" class="overflow-hidden rounded-lg border border-default bg-elevated/50">
      <div
        v-for="(step, index) in quickStart.steps"
        :key="step.command"
        class="grid gap-3 border-b border-default p-5 last:border-b-0 sm:grid-cols-[32px_minmax(0,1fr)_auto] sm:items-center"
      >
        <span class="font-mono text-sm text-primary">{{ String(index + 1).padStart(2, '0') }}</span>
        <div class="min-w-0">
          <code class="block overflow-x-auto font-mono text-sm text-highlighted">{{ step.command }}</code>
          <p class="mt-1 text-sm text-muted">{{ step.description }}</p>
        </div>
        <UTooltip :text="copiedCommand === step.command ? quickStart.copied : quickStart.copy">
          <UButton
            :icon="copiedCommand === step.command ? 'i-lucide-copy-check' : 'i-lucide-copy'"
            color="neutral"
            variant="ghost"
            :aria-label="quickStart.copy"
            @click="copyCommand(step.command)"
          />
        </UTooltip>
      </div>
    </Motion>
  </UPageSection>
</template>
