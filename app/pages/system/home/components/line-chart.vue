<script setup lang="ts">
/**
 * 订单趋势折线图：数据完全来自 `sysHome.overview.trend`（14 天，服务端已补零）。
 * 数量走左轴、金额走右轴（`yAxisIndex: 1`），标题由父页面按 scope 下发。
 */
type TrendSeries = {
  key: 'orderCount' | 'orderAmount'
  unit: 'count' | 'money'
  data: number[]
}

const props = withDefaults(defineProps<{
  trend?: { dates: string[], series: TrendSeries[] } | null
  title?: string
}>(), {
  trend: null,
  title: ''
})

defineOptions({ name: 'LineChart' })

const { $getLocale, $ts } = useI18n()

const dates = computed(() => props.trend?.dates ?? [])
const orderCountData = computed(() => props.trend?.series.find(item => item.key === 'orderCount')?.data ?? [])
const orderAmountData = computed(() => props.trend?.series.find(item => item.key === 'orderAmount')?.data ?? [])

/** 无日期或两条序列全 0 时视为空态，不画空坐标系 */
const isEmpty = computed(() => {
  if (dates.value.length === 0) return true
  const all = [...orderCountData.value, ...orderAmountData.value]
  return all.length === 0 || all.every(value => !value)
})

const countLabel = computed(() => $ts('page.home.orderCount'))
const amountLabel = computed(() => $ts('page.home.orderAmount'))

function buildOptions() {
  return {
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: {
        type: 'cross' as const,
        label: { backgroundColor: '#6a7985' }
      }
    },
    legend: {
      top: 0,
      data: [countLabel.value, amountLabel.value]
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category' as const,
      boundaryGap: false,
      data: [...dates.value]
    },
    yAxis: [
      // 左轴：订单数量
      { type: 'value' as const, name: countLabel.value },
      // 右轴：订单金额（与数量量级差异大，必须分轴）
      { type: 'value' as const, name: amountLabel.value }
    ],
    series: [
      {
        color: '#8e9dff',
        name: countLabel.value,
        type: 'line' as const,
        smooth: true,
        yAxisIndex: 0,
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0.25, color: '#8e9dff' },
              { offset: 1, color: '#fff' }
            ]
          }
        },
        emphasis: { focus: 'series' as const },
        data: [...orderCountData.value]
      },
      {
        color: '#26deca',
        name: amountLabel.value,
        type: 'line' as const,
        smooth: true,
        yAxisIndex: 1,
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0.25, color: '#26deca' },
              { offset: 1, color: '#fff' }
            ]
          }
        },
        emphasis: { focus: 'series' as const },
        data: [...orderAmountData.value]
      }
    ]
  }
}

// 用新的对象整体替换 options：ECharts 会复用实例（autoresize 依赖同一实例），
// 避免原地深改同一个对象时旧序列残留。
const options = shallowRef(buildOptions())

watch(
  [() => props.trend, () => $getLocale()],
  () => {
    options.value = buildOptions()
  }
)
</script>

<template>
  <UCard>
    <template #header>
      <span>{{ props.title }}</span>
    </template>
    <div class="h-[360px] rounded-lg">
      <div v-if="isEmpty" class="flex h-full items-center justify-center text-sm text-muted">
        {{ $ts('common.noData') }}
      </div>
      <VChart v-else :option="options" autoresize />
    </div>
  </UCard>
</template>
