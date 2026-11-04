<script setup lang="ts">
import LandingFooter from '~/pages/landing/components/LandingFooter.vue'
import LandingHeader from '~/pages/landing/components/LandingHeader.vue'
</script>

<template>
  <div class="landing-shell min-h-screen bg-default text-default">
    <LandingHeader />
    <UMain>
      <slot />
    </UMain>
    <LandingFooter />
  </div>
</template>
