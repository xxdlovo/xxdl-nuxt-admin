<script setup lang="ts">
const { $getLocales, $t } = useI18n()


interface CardData {
  key: string;
  title: any;
  value: number;
  unit: string;
  color: {
    start: string;
    end: string;
  };
  icon: string;
}

const cardData = computed<CardData[]>(() => [
  {
    key: 'visitCount',
    title: $t('page.home.visitCount'),
    value: 9725,
    unit: '',
    color: { start: '#ec4786', end: '#b955a4' },
    icon: 'i-tabler:chart-histogram'
  },
  {
    key: 'turnover',
    title: $t('page.home.turnover'),
    value: 1026,
    unit: '$',
    color: { start: '#865ec0', end: '#5144b4' },
    icon: 'i-tabler:report-money'
  },
  {
    key: 'downloadCount',
    title: $t('page.home.downloadCount'),
    value: 970925,
    unit: '',
    color: { start: '#56cdf3', end: '#719de3' },
    icon: 'i-tabler:file-download'
  },
  {
    key: 'dealCount',
    title: $t('page.home.dealCount'),
    value: 9527,
    unit: '',
    color: { start: '#fcbc25', end: '#f68057' },
    icon: 'i-tabler:registered'
  }
]);
function getGradientColor(color: CardData['color']) {
  return `linear-gradient(to bottom right, ${color.start}, ${color.end})`;
}
</script>

<template>
    <UCard>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 ">
      <div 
        v-for="item in cardData" 
        :key="item.key"
        class="w-full"
      >
        <div 
          class="w-full rounded-lg px-4 py-3 text-white h-full"
          :style="{ backgroundImage: getGradientColor(item.color) }"
        >
          <h3 class="text-base font-medium mb-3">{{ item.title }}</h3>
          <div class="flex justify-between items-center">
            <UIcon :name="item.icon" class="size-8" />
            <span class="text-2xl font-bold">
              {{ item.unit }}{{ item.value }}
            </span>
          </div>
        </div>
      </div>
   </div>
   </UCard>
</template>

