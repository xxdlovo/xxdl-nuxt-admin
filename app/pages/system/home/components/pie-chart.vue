<script setup lang="ts">
/**
 * 分布饼图：管理员看订单状态分布（WP/OD/CL/FL），个人看余额构成（recharge/gift/frozen）。
 * 服务端只给枚举 name + value，展示文案在前端按 `kind` 映射 i18n。
 */
type PieItem = { name: string, value: number }

const props = withDefaults(defineProps<{
  pie?: { kind: 'orderStatus' | 'balance', items: PieItem[] } | null
  title?: string
}>(), {
  pie: null,
  title: ''
})

defineOptions({ name: 'PieChart' })

const { $getLocale, $ts } = useI18n()

const mappedItems = computed<PieItem[]>(() => (props.pie?.items ?? []).map(item => ({
  name: props.pie?.kind === 'balance'
    ? $ts(`page.home.balance.${item.name}`)
    : $ts(`page.home.orderStatus.${item.name}`),
  value: item.value
})))

/** 无分项或全部为 0 时不画空饼图 */
const isEmpty = computed(() => mappedItems.value.length === 0 || mappedItems.value.every(item => !item.value))

function buildOptions() {
  return {
    tooltip: { trigger: 'item' as const },
    legend: {
      bottom: '1%',
      left: 'center',
      itemStyle: { borderWidth: 0 }
    },
    series: [
      {
        color: ['#5da8ff', '#8e9dff', '#fedc69', '#26deca'],
        name: props.title,
        type: 'pie' as const,
        radius: ['45%', '75%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 1
        },
        label: { show: false, position: 'center' as const },
        emphasis: {
          label: { show: true, fontSize: '12' }
        },
        labelLine: { show: false },
        data: mappedItems.value.map(item => ({ ...item }))
      }
    ]
  }
}

// 与折线图一致：数据或语言变化时整体重建 options，保留同一个 ECharts 实例
const options = shallowRef(buildOptions())

watch(
  [() => props.pie, () => props.title, () => $getLocale()],
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
    <div class="h-[360px] rounded-lg flex justify-center items-center">
      <div v-if="isEmpty" class="flex h-full items-center justify-center text-sm text-muted">
        {{ $ts('common.noData') }}
      </div>
      <VChart v-else :option="options" />
    </div>
  </UCard>
</template>
