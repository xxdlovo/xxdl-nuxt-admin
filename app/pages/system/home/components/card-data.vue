<script setup lang="ts">
import { useRbacProfile } from '~/composables/useRbacProfile'

/**
 * 数据卡片：服务端只给 `{ key, value, unit }`，图标 / 渐变色 / 跳转路由全部由前端按键映射，
 * 因此新增或改名 key 时只需同步「i18n + 下方两张表」。
 */
const props = withDefaults(defineProps<{
  cards?: Array<{ key: string, value: string, unit: 'count' | 'money' }>
}>(), {
  cards: () => []
})

type CardMeta = { icon: string, start: string, end: string, to: string }

/** 管理员口径：运营总览 + 订单/会员/商品管理入口 */
const ADMIN_META: Record<string, CardMeta> = {
  todayOrderCount: { icon: 'i-lucide-shopping-cart', start: '#865ec0', end: '#5144b4', to: '/system/order' },
  todayOrderAmount: { icon: 'i-lucide-badge-japanese-yen', start: '#ec4786', end: '#b955a4', to: '/system/order' },
  pendingCount: { icon: 'i-lucide-clock', start: '#fcbc25', end: '#f68057', to: '/system/order' },
  pendingFulfillCount: { icon: 'i-lucide-truck', start: '#56cdf3', end: '#719de3', to: '/system/order' },
  totalOrderAmount: { icon: 'i-lucide-trending-up', start: '#26deca', end: '#4f9d9b', to: '/system/order' },
  totalRechargeAmount: { icon: 'i-lucide-wallet', start: '#8e9dff', end: '#5da8ff', to: '/system/member-recharge' }
}

/** 个人口径：钱包 / 我的订单入口（个人只能进 protectedProcedure 页面，管理端页面会 403） */
const SELF_META: Record<string, CardMeta> = {
  myBalance: { icon: 'i-lucide-wallet', start: '#865ec0', end: '#5144b4', to: '/system/wallet' },
  myGift: { icon: 'i-lucide-gift', start: '#ec4786', end: '#b955a4', to: '/system/wallet' },
  // 优惠券明细在钱包页签里，管理端 /system/member-coupon 需要权限码
  myCoupon: { icon: 'i-lucide-ticket', start: '#fcbc25', end: '#f68057', to: '/system/wallet' },
  myOrderTotal: { icon: 'i-lucide-shopping-cart', start: '#56cdf3', end: '#719de3', to: '/system/my-orders' },
  myPending: { icon: 'i-lucide-clock', start: '#8e9dff', end: '#5da8ff', to: '/system/my-orders' },
  myFulfill: { icon: 'i-lucide-truck', start: '#26deca', end: '#4f9d9b', to: '/system/my-orders' },
  myCompleted: { icon: 'i-lucide-circle-check', start: '#51c16b', end: '#2f9e6b', to: '/system/my-orders' },
  myConsume: { icon: 'i-lucide-credit-card', start: '#f0708f', end: '#c04d7c', to: '/system/my-orders' },
  // 管理端 /system/member-recharge 需要权限码，充值记录在钱包页签里看
  myRecharge: { icon: 'i-lucide-circle-dollar-sign', start: '#f2a33c', end: '#d0762c', to: '/system/wallet' }
}

/** 兜底配色循环，避免服务端新增未知 key 时卡片没有视觉 */
const FALLBACK_COLORS: Array<[string, string]> = [
  ['#8e9dff', '#5da8ff'],
  ['#26deca', '#4f9d9b'],
  ['#ec4786', '#b955a4']
]

const { $ts } = useI18n()
const { isAdmin } = useRbacProfile()

const cardList = computed(() => (props.cards ?? []).map((item, index) => {
  const meta = isAdmin.value ? ADMIN_META[item.key] : SELF_META[item.key]
  const fallback = FALLBACK_COLORS[index % FALLBACK_COLORS.length]!
  return {
    key: item.key,
    label: $ts(`page.home.card.${item.key}`),
    text: item.unit === 'money' ? `¥${item.value}` : item.value,
    icon: meta?.icon ?? 'i-lucide-chart-pie',
    start: meta?.start ?? fallback[0],
    end: meta?.end ?? fallback[1],
    // 普通用户走个人路由（protectedProcedure，不需要权限），管理员才有管理端入口
    to: isAdmin.value ? (meta?.to ?? '') : (SELF_META[item.key]?.to ?? '')
  }
}))

/** 3 张（管理员最小集）与 6 张（个人/扩展集）自适应，避免固定 4 列留下空位 */
const gridClass = computed(() => (cardList.value.length <= 3
  ? 'grid grid-cols-1 sm:grid-cols-3 gap-8'
  : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8'))

function gradientOf(start: string, end: string) {
  return `linear-gradient(to bottom right, ${start}, ${end})`
}
</script>

<template>
  <UCard>
    <div :class="gridClass">
      <template v-for="item in cardList" :key="item.key">
        <NuxtLink
          v-if="item.to"
          :to="item.to"
          class="block w-full cursor-pointer transition hover:opacity-90"
        >
          <div
            class="w-full rounded-lg px-4 py-3 text-white h-full"
            :style="{ backgroundImage: gradientOf(item.start, item.end) }"
          >
            <h3 class="text-base font-medium mb-3">{{ item.label }}</h3>
            <div class="flex justify-between items-center">
              <UIcon :name="item.icon" class="size-8" />
              <span class="text-2xl font-bold">{{ item.text }}</span>
            </div>
          </div>
        </NuxtLink>

        <div v-else class="w-full">
          <div
            class="w-full rounded-lg px-4 py-3 text-white h-full"
            :style="{ backgroundImage: gradientOf(item.start, item.end) }"
          >
            <h3 class="text-base font-medium mb-3">{{ item.label }}</h3>
            <div class="flex justify-between items-center">
              <UIcon :name="item.icon" class="size-8" />
              <span class="text-2xl font-bold">{{ item.text }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </UCard>
</template>
