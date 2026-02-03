<template>
  <UCard>
    <!-- 主容器使用flex布局，实现响应式排列 -->
    <div class="flex flex-col md:flex-row gap-4">
      <!-- 左侧用户信息区域 - flex占比3/4 -->
      <div class="flex-1 md:flex-1 lg:flex-3 flex items-center">
        <!-- 头像 -->
        <div class="w-18 h-18 rounded-full overflow-hidden flex-shrink-0">
          <img 
            src="@/assets/imgs/soybean.jpg" 
            alt="用户头像" 
            class="w-full h-full object-cover"
          >
        </div>
        
        <!-- 问候信息 -->
        <div class="ml-3">
          <h3 class="text-lg font-semibold">
            {{ $t('page.home.greeting', { userName: '用户名' }) }}
          </h3>
          <p class="text-gray-500 mt-1 leading-relaxed">
            {{ $t('page.home.weatherDesc') }}
          </p>
        </div>
      </div>
      
      <!-- 右侧统计数据区域 - flex占比1/4 -->
      <div class="flex-1 md:flex-1 flex justify-end items-center gap-6">
        <div v-for="item in statisticData" :key="item.id" class="text-center whitespace-nowrap">
            <!-- 统计标签 -->
          <div class="text-sm text-gray-500 mt-1">{{ item.label }}</div>
          <!-- 统计数值 -->
          <div class="text-xl font-bold">{{ item.value }}</div>
        
        </div>
      </div>
    </div>
  </UCard>
</template>

<script setup>
const { $t } = useI18n()

const statisticData = [
  { id: 1, label: $t('page.home.projectCount'), value: 25 },
  { id: 2, label: $t('page.home.todo'), value: '4/16' },
  { id: 3, label: $t('page.home.message'), value: 12 }
]
</script>
