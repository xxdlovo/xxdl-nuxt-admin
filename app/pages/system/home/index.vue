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
import CreativityBanner from './components/creativity-banner.vue'
import NoticeNews  from "./components/notice-news.vue";
const users = ref([
  {
    name: 'Benjamin Canac',
    description: 'benjamincanac',
    to: 'https://github.com/benjamincanac',
    target: '_blank',
    avatar: {
      src: 'https://github.com/benjamincanac.png',
      alt: 'benjamincanac'
    }
  },
  {
    name: 'Sylvain Marroufin',
    description: 'smarroufin',
    to: 'https://github.com/smarroufin',
    target: '_blank',
    avatar: {
      src: 'https://github.com/smarroufin.png',
      alt: 'smarroufin'
    }
  },
  {
    name: 'Sébastien Chopin',
    description: 'atinux',
    to: 'https://github.com/atinux',
    target: '_blank',
    avatar: {
      src: 'https://github.com/atinux.png',
      alt: 'atinux'
    }
  },
  {
    name: 'Romain Hamel',
    description: 'romhml',
    to: 'https://github.com/romhml',
    target: '_blank',
    avatar: {
      src: 'https://github.com/romhml.png',
      alt: 'romhml'
    }
  }
])
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
