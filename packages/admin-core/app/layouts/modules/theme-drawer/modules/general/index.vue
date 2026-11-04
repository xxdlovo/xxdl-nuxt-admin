<script setup lang="ts">
import GlobalSettings from './modules/global-settings.vue'
import WatermarkSettings from './modules/watermark-settings.vue'

defineOptions({
  name: 'ThemeGeneral'
})
</script>

<template>
  <div class="space-y-5">
    <GlobalSettings />
    <WatermarkSettings />
  </div>
</template>
