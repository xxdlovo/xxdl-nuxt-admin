<script setup lang="ts">
import { useRbacProfile } from '~/composables/useRbacProfile'
import { useMemberProfileStore } from '~/stores/memberProfile'

/**
 * 首页横幅：左侧问候 + 右侧 3 项统计。
 * 统计项由父页面从 `sysHome.overview.stats` 下发（key/value/unit），文案在前端按键映射。
 */
const props = withDefaults(defineProps<{
  stats?: Array<{ key: string, value: string, unit: 'count' | 'money' }>
  generatedAt?: string
  scope?: 'admin' | 'self'
  loading?: boolean
  /** 父页面是否已拿到 overview：没拿到前 scope 还是默认值，不能据此去取会员等级 */
  loaded?: boolean
}>(), {
  stats: () => [],
  generatedAt: '',
  scope: 'self',
  loading: false,
  loaded: false
})

const emit = defineEmits<{ refresh: [] }>()

const { $t, $ts } = useI18n()
const { username } = useRbacProfile()

/** 统计项文案：键与契约固定 key 清单一致，未命中的 key 直接回退为 key 本身 */
const statItems = computed(() => (props.stats ?? []).map(item => ({
  key: item.key,
  label: $ts(`page.home.stat.${item.key}`),
  value: item.unit === 'money' ? `¥${item.value}` : item.value
})))

/**
 * 会员等级（仅个人身份展示）：`ensure()` 内部吞掉异常并返回 null，
 * 取不到就不渲染，拿等级失败不能影响横幅本身。
 */
const memberProfileStore = useMemberProfileStore()
const levelName = computed(() => memberProfileStore.profile?.levelName ?? '')

watch(
  [() => props.loaded, () => props.scope],
  async ([loaded, scope]) => {
    // 管理员不展示会员等级，避免多打一次 myProfile 接口
    if (!loaded || scope !== 'self') return
    await memberProfileStore.ensure()
  },
  { immediate: true }
)

/** `generatedAt` 形如 `YYYY-MM-DD HH:mm:ss`，只展示到分钟，避免右侧副标题过长 */
const updatedAtText = computed(() => {
  const raw = props.generatedAt
  if (!raw) return ''
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(raw)
  const time = match ? `${match[1]} ${match[2]}` : raw
  return $t('page.home.updatedAt', { time }) as string
})
</script>

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
            {{ $t('page.home.greeting', { userName: username ?? '' }) }}
            <UBadge v-if="scope === 'self' && levelName" color="primary" variant="soft" size="sm" class="ml-1 align-middle">
              {{ levelName }}
            </UBadge>
          </h3>
          <p class="text-gray-500 mt-1 leading-relaxed">
            {{ updatedAtText || $ts('common.loading') }}
          </p>
        </div>
      </div>
      
      <!-- 右侧统计数据区域 - flex占比1/4 -->
      <div class="flex-1 md:flex-1 flex justify-end items-center gap-6">
        <div v-for="item in statItems" :key="item.key" class="text-center whitespace-nowrap">
            <!-- 统计标签 -->
          <div class="text-sm text-gray-500 mt-1">{{ item.label }}</div>
          <!-- 统计数值 -->
          <div class="text-xl font-bold">
            <USkeleton v-if="loading && !item.value" class="mx-auto h-6 w-20" />
            <template v-else>{{ item.value }}</template>
          </div>
        </div>

        <!-- 刷新：由子组件 emit 给父页面重取 overview -->
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="ghost"
          size="sm"
          square
          :loading="loading"
          :aria-label="$ts('common.refresh')"
          @click="emit('refresh')"
        />
      </div>
    </div>
  </UCard>
</template>
