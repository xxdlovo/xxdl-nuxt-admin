<script setup lang="ts">
import { useLandingLocale } from '../useLandingLocale'
import LandingLogo from './LandingLogo.vue'

const { content: page } = useLandingLocale()
</script>

<template>
  <UFooter :ui="{ container: 'border-t border-default py-8 lg:py-10', left: 'items-start' }">
    <template #left>
      <div class="space-y-2">
        <LandingLogo :name="page.brand.name" />
        <p class="max-w-sm text-sm leading-relaxed text-dimmed">
          {{ page.footer.description }}
        </p>
        <p class="text-xs text-muted">
          Copyright {{ new Date().getFullYear() }} NuxtAdmin. {{ page.footer.copyright }}
        </p>
      </div>
    </template>

    <template #right>
      <div class="flex flex-col items-end gap-3">
        <nav class="flex flex-wrap justify-end gap-x-1 gap-y-2">
          <UButton
            v-for="link in page.footer.links"
            :key="link.to"
            :label="link.label"
            :to="link.to"
            color="neutral"
            variant="link"
            size="sm"
          />
        </nav>

        <a
          href="https://v6.51.la/land/3QgZUAv8LBLeVflg"
          target="_blank"
          rel="noopener noreferrer"
          title="51la网站统计"
          class="inline-flex opacity-80 transition-opacity hover:opacity-100"
        >
          <img
            src="https://sdk.51.la/icon/1-3.png"
            alt="51la网站统计"
            class="h-auto max-w-full"
          >
        </a>
      </div>
    </template>
  </UFooter>
</template>
