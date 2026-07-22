<script setup lang="ts">
import ContentSettings from './modules/content-settings.vue'
import FooterSettings from './modules/footer-settings.vue'
import HeaderSettings from './modules/header-settings.vue'
import LayoutMode from './modules/layout-mode.vue'
import SiderSettings from './modules/sider-settings.vue'
import TabSettings from './modules/tab-settings.vue'

</script>

<template>
  <div class="space-y-5">
    <LayoutMode />
    <TabSettings />
    <HeaderSettings />
    <SiderSettings />
    <FooterSettings />
    <ContentSettings />
  </div>
</template>
