<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '首页',
  icon: 'i-lucide-house'
})

import HeaderBanner from './components/header-banner.vue'
import CardData from './components/card-data.vue'
import LineChart from './components/line-chart.vue'
import PieChart from './components/pie-chart.vue'
import ProjectNews from './components/project-news.vue'
import NoticeNews  from "./components/notice-news.vue";

</script>

<template>
  <div class="space-y-4 p-4">
    <UPageList>
      <HeaderBanner />
    </UPageList>

    <UPageList>
      <CardData />
    </UPageList>

    <UPageList>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <LineChart />
        <PieChart />
      </div>
    </UPageList>

    <UPageList>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ProjectNews />
        <NoticeNews />
      </div>
    </UPageList>
  </div>
</template>
