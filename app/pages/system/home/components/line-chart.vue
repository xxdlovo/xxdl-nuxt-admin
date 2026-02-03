<script setup lang="ts">
const { $getLocale, $t } = useI18n()

defineOptions({ name: 'LineChart' })


// 初始 options
const options = ref({
  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'cross',
      label: { backgroundColor: '#6a7985' },
    },
  },
  legend: {
    top: 0,
    data: [$t('page.home.downloadCount'), $t('page.home.registerCount')],

  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    containLabel: true,
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: [] as string[],
  },
  yAxis: { type: 'value' },
  series: [
    {
      color: '#8e9dff',
      name: $t('page.home.downloadCount'),
      type: 'line',
      smooth: true,
      stack: 'Total',
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0.25, color: '#8e9dff' },
            { offset: 1, color: '#fff' },
          ],
        },
      },
      emphasis: { focus: 'series' },
      data: [] as number[],
    },
    {
      color: '#26deca',
      name: $t('page.home.registerCount'),
      type: 'line',
      smooth: true,
      stack: 'Total',
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0.25, color: '#26deca' },
            { offset: 1, color: '#fff' },
          ],
        },
      },
      emphasis: { focus: 'series' },
      data: [] as number[],
    },
  ],
})

async function mockData() {
  await new Promise((resolve) => setTimeout(resolve, 1000))

  options.value.xAxis.data = [
    '06:00',
    '08:00',
    '10:00',
    '12:00',
    '14:00',
    '16:00',
    '18:00',
    '20:00',
    '22:00',
    '24:00',
  ]
  if (!options.value.series || !options.value.series[0] || !options.value.series[1]) {
    return
  }
  options.value.series[0].data = [
    4623, 6145, 6268, 6411, 1890, 4251, 2978, 3880, 3606, 4311,
  ]
  options.value.series[1].data = [
    2208, 2016, 2916, 4512, 8281, 2008, 1963, 2367, 2956, 678,
  ]
}

function updateLocale() {

  options.value.legend.data = [
    $t('page.home.downloadCount') as string,
    $t('page.home.registerCount') as string,
  ]
  options.value.series![0]!.name! = $t('page.home.downloadCount') as string
  options.value.series![1]!.name! = $t('page.home.registerCount') as string
}

watch(
  () => $getLocale(),
  () => {
    updateLocale()
  },
)

mockData()
</script>

<template>
  <UCard>
    <div class="h-[360px]   rounded-lg">
      <VChart :option="options" autoresize />
    </div>
  </UCard>
</template>
