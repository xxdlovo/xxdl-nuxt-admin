<script setup lang="ts">
import HeaderBanner from './components/header-banner.vue'
import CardData from './components/card-data.vue'
import LineChart from './components/line-chart.vue'
import PieChart from './components/pie-chart.vue'
import ProjectNews from './components/project-news.vue'
import CreativityBanner from './components/creativity-banner.vue'
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
  <!-- <UPage> -->
  <!-- <UPageBody class="bg-amber-300"> -->


  <UPageList>

    <HeaderBanner />
  </UPageList>
  <UPageList>
    <CardData />
  </UPageList>
  <UPageList>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <LineChart />
      <PieChart />
    </div>
  </UPageList>
  <UPageList>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <ProjectNews />
      <CreativityBanner />
    </div>
  </UPageList>
  <!-- </UPageBody> -->
  <!-- </UPage> -->

  <!-- <div class="h-[555px] rounded-3xl bg-red-50">
hello
  </div> -->
</template>
