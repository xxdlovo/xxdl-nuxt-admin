<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import { memberCouponUseStatusConfig } from '#shared/constants/business'
import { useBadgeColumn } from '~/composables/useTable'

/**
 * 使用记录行：接口 sysMemberCoupon.uses 返回核销记录联表 sys_user 的昵称/账号/手机号。
 * shared 里没有对应的输出 schema（该接口直接透出 Repo 的联表结果），这里按接口字段就地声明。
 */
type MemberCouponUseRow = {
  id?: string | null
  userId?: string | null
  nickname?: string | null
  username?: string | null
  phone?: string | null
  status?: string | null
  discountAmount?: string | null
  giftAmount?: string | null
  bizNo?: string | null
  usedAt?: string | null
  createdAt?: string | null
}

const props = defineProps<{
  visible: boolean
  couponId?: string | null
  couponCode?: string | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

/** 固定每页 10 条：使用记录是二级弹窗里的辅助信息，不提供每页条数切换 */
const pageSize = 10
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const rows = ref<MemberCouponUseRow[]>([])

const displayValue = (value: unknown) => (value == null || value === '' ? '-' : String(value))

/** 使用人：昵称 → 账号 → 用户ID 逐级兜底，三者都空才显示 '-' */
const userText = (row: MemberCouponUseRow) => row.nickname || row.username || row.userId || '-'

const columns = computed<TableColumn<MemberCouponUseRow>[]>(() => [
  {
    id: 'user',
    header: () => $ts('module.system.memberCoupon.useUser'),
    cell: ({ row }) => h('span', { class: 'break-all' }, userText(row.original))
  },
  {
    id: 'phone',
    header: () => $ts('module.system.memberCoupon.usePhone'),
    cell: ({ row }) => displayValue(row.original.phone)
  },
  useBadgeColumn<MemberCouponUseRow>('status', 'module.system.memberCoupon.useStatusLabel', memberCouponUseStatusConfig),
  {
    id: 'discountAmount',
    header: () => $ts('module.system.memberCoupon.useDiscount'),
    cell: ({ row }) => displayValue(row.original.discountAmount)
  },
  {
    id: 'giftAmount',
    header: () => $ts('module.system.memberCoupon.useGift'),
    cell: ({ row }) => displayValue(row.original.giftAmount)
  },
  {
    id: 'bizNo',
    header: () => $ts('module.system.memberCoupon.useBizNo'),
    cell: ({ row }) => h('span', { class: 'break-all' }, displayValue(row.original.bizNo))
  },
  {
    id: 'usedAt',
    header: () => $ts('module.system.memberCoupon.useTime'),
    cell: ({ row }) => displayValue(row.original.usedAt)
  },
  {
    id: 'createdAt',
    header: () => $ts('module.system.memberCoupon.useCreatedAt'),
    cell: ({ row }) => displayValue(row.original.createdAt)
  }
])

/** 翻页或首次打开：page 由 UPagination 的 v-model 维护，@update:page 直接把新页码传进来 */
const loadUses = async (targetPage = page.value) => {
  const couponId = props.couponId

  if (!couponId) {
    rows.value = []
    total.value = 0
    return
  }

  loading.value = true
  page.value = targetPage

  try {
    const result = await $trpc.sysMemberCoupon.uses.query({
      couponId,
      page: page.value,
      pageSize
    })

    rows.value = (result.list ?? []) as MemberCouponUseRow[]
    total.value = result.total ?? 0
  } catch {
    // 券已被删除等错误由全局 tRPC 链路提示，这里只保证弹窗不残留上一次的记录
    rows.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

watch(visible, (opened) => {
  if (opened) {
    void loadUses(1)
  }
})
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="`${$ts('module.system.memberCoupon.usesTitle')} · ${couponCode || '-'}`"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[1080px]', footer: 'justify-end' }"
  >
    <template #body>
      <div class="space-y-3">
        <UTable :data="rows" :columns="columns" :loading="loading" class="w-full">
          <template #empty>
            <div class="py-8 text-center text-sm text-muted">
              {{ $ts('module.system.memberCoupon.usesEmpty') }}
            </div>
          </template>
        </UTable>

        <div v-if="total > 0" class="flex justify-end pt-2 border-t border-default">
          <UPagination
            v-model:page="page"
            :total="total"
            :items-per-page="pageSize"
            :disabled="loading"
            @update:page="loadUses"
          />
        </div>
      </div>
    </template>

    <template #footer>
      <UButton color="neutral" variant="subtle" @click="visible = false">
        {{ $ts('common.close') }}
      </UButton>
    </template>
  </UModal>
</template>
