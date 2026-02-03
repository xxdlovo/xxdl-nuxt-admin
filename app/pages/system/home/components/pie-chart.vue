<script setup lang="ts">

const { $getLocale, $t } = useI18n()

defineOptions({ name: 'PieChart' })

const options = ref({
  tooltip: {
    trigger: 'item',
  },
  legend: {
    bottom: '1%',
    left: 'center',
    itemStyle: {
      borderWidth: 0,
    },
  },
  series: [
    {
      color: ['#5da8ff', '#8e9dff', '#fedc69', '#26deca'],
      name: $t('page.home.schedule'), // 固定 key
      type: 'pie',
      radius: ['45%', '75%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: '#fff',
        borderWidth: 1,
      },
      label: {
        show: false,
        position: 'center',
      },
      emphasis: {
        label: {
          show: true,
          fontSize: '12',
        },
      },
      labelLine: {
        show: false,
      },
      data: [] as { name: string; value: number }[],
    },
  ],
})

async function mockData() {
  await new Promise((resolve) => setTimeout(resolve, 1000))

  options.value.series![0]!.data = [
    { name: 'study', value: 20 },
    { name: 'entertainment', value: 10 },
    { name: 'work', value: 40 },
    { name: 'rest', value: 30 },
  ]
}
const chartRef = ref<any>(null)
// 监听窗口变化，自动调用 ECharts resize
const handleResize = () => {
  chartRef.value?.resize?.()
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
watch(
  () => $getLocale(),
  () => {

    options.value.series![0]!.name = $t('page.home.schedule') as string
    options.value.series![0]!.data![0]!.name = $t('page.home.study') as string
    options.value.series![0]!.data![1]!.name = $t('page.home.entertainment') as string
    options.value.series![0]!.data![2]!.name = $t('page.home.work') as string
    options.value.series![0]!.data![3]!.name = $t('page.home.rest') as string
  })


mockData()
</script>

<template>
  <UCard>
    <div class="h-[360px]  rounded-lg flex justify-center items-center">
      <VChart ref="chartRef" :option="options" />
    </div>
  </UCard>

</template>
