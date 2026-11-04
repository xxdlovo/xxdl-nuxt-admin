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

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

/**
 * 看板数据源：`sysHome.overview` 已按登录身份（管理员 / 普通会员）返回不同口径的 stats/cards/trend/pie，
 * 因此本页只做「取数 + 下发」，所有文案与展示形态由子组件负责。
 * 接口返回类型由 AppRouter 推导，不在此处手写 DTO（避免与服务端契约漂移）。
 */
type Overview = Awaited<ReturnType<typeof $trpc.sysHome.overview.query>>

const overview = ref<Overview | null>(null)
const loading = ref(false)
/** 仅用于区分「首次加载失败」：失败后保留错误态给用户重试按钮，提示 toast 由全局错误插件负责 */
const loadFailed = ref(false)
const refreshing = ref(false)

async function loadOverview() {
  loading.value = true
  loadFailed.value = false
  try {
    overview.value = await $trpc.sysHome.overview.query()
  } catch {
    // 全局 tRPC 错误插件已 toast，这里只切到本地错误态
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

/** 刷新：重取一次，成功时更新 generatedAt（模板取 overview.generatedAt） */
async function refresh() {
  refreshing.value = true
  try {
    await loadOverview()
  } finally {
    refreshing.value = false
  }
}

onMounted(() => {
  loadOverview()
})

const scope = computed(() => overview.value?.scope ?? 'self')
/** 图表标题随身份切换：父组件决定标题文案，子组件只渲染传入的 title */
const trendTitle = computed(() => $ts(scope.value === 'admin' ? 'page.home.orderTrendTitle' : 'page.home.myTrendTitle'))
const pieTitle = computed(() => $ts(scope.value === 'admin' ? 'page.home.orderStatusDistTitle' : 'page.home.myBalancePieTitle'))
</script>

<template>
  <div class="space-y-4 p-4">
    <!-- 加载骨架 -->
    <template v-if="loading && !overview">
      <UCard>
        <div class="flex flex-col gap-6 md:flex-row md:items-center">
          <div class="flex flex-1 items-center gap-3">
            <USkeleton class="size-18 rounded-full" />
            <div class="space-y-2">
              <USkeleton class="h-5 w-48" />
              <USkeleton class="h-4 w-32" />
            </div>
          </div>
          <div class="flex flex-1 justify-end gap-6">
            <div v-for="i in 3" :key="i" class="space-y-2 text-center">
              <USkeleton class="h-4 w-16" />
              <USkeleton class="mx-auto h-6 w-20" />
            </div>
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <USkeleton v-for="i in 6" :key="i" class="h-24 w-full rounded-lg" />
        </div>
      </UCard>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <USkeleton class="h-[420px] w-full rounded-lg" />
        <USkeleton class="h-[420px] w-full rounded-lg" />
      </div>
    </template>

    <!-- 首次加载失败 -->
    <UCard v-else-if="loadFailed && !overview">
      <div class="flex flex-col items-center justify-center gap-3 py-10">
        <span class="text-sm text-muted">{{ $ts('page.home.loadFailed') }}</span>
        <UButton icon="i-lucide-refresh-cw" color="primary" variant="soft" :loading="loading" @click="loadOverview">
          {{ $ts('page.home.retry') }}
        </UButton>
      </div>
    </UCard>

    <template v-else>
      <UPageList>
        <HeaderBanner
          :stats="overview?.stats ?? []"
          :generated-at="overview?.generatedAt ?? ''"
          :scope="scope"
          :loaded="!!overview"
          :loading="refreshing"
          @refresh="refresh"
        />
      </UPageList>

      <UPageList>
        <CardData :cards="overview?.cards ?? []" />
      </UPageList>

      <UPageList>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <LineChart :trend="overview?.trend ?? null" :title="trendTitle" />
          <PieChart :pie="overview?.pie ?? null" :title="pieTitle" />
        </div>
      </UPageList>
    </template>

    <UPageList>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ProjectNews />
        <NoticeNews />
      </div>
    </UPageList>
  </div>
</template>
