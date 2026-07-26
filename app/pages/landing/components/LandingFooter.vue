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
    </template>
  </UFooter>
</template>
