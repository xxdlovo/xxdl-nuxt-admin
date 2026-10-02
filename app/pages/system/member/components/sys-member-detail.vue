<script setup lang="ts">
import { memberAccountRecord, memberBizTypeRecord, memberDirectionRecord, memberStatusConfig } from '#shared/constants/business'
import { badgeColorClasses } from '~/composables/badgeColorClasses'
import type { MemberProfileRow } from './types'

type BalanceLogItem = {
  id?: string | null
  account?: string | null
  direction?: string | null
  amount?: string | null
  bizType?: string | null
  bizNo?: string | null
  createdAt?: string | null
}

const props = defineProps<{
  visible: boolean
  data?: MemberProfileRow | null
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

const logs = ref<BalanceLogItem[]>([])
const logsLoading = ref(false)

const displayValue = (value: unknown) => (value == null || value === '' ? '-' : String(value))

const translate = (record: Record<string, string>, value?: string | null) => {
  if (!value) return '-'
  const key = record[value]

  return key ? $ts(key) : value
}

const statusBadge = computed(() => {
  const item = props.data?.status === null || props.data?.status === undefined
    ? undefined
    : memberStatusConfig[String(props.data.status)]

  if (!item) {
    return { label: '-', class: badgeColorClasses.neutral }
  }

  return { label: $ts(item.i18nKey), class: badgeColorClasses[item.color] || badgeColorClasses.neutral }
})

/** 可用余额 = 账户余额 - 冻结额（与领域层 WalletSnapshot 的口径一致） */
const available = (balance?: string | null, frozen?: string | null) => {
  const value = Number(balance ?? 0) - Number(frozen ?? 0)

  return Number.isFinite(value) ? value.toFixed(2) : '0.00'
}

const walletItems = computed(() => {
  const item = props.data

  return [
    { label: $ts('module.system.member.walletRecharge'), value: item?.rechargeBalance },
    { label: $ts('module.system.member.walletGift'), value: item?.giftBalance },
    { label: $ts('module.system.member.walletFrozenRecharge'), value: item?.frozenRecharge },
    { label: $ts('module.system.member.walletFrozenGift'), value: item?.frozenGift },
    { label: $ts('module.system.member.walletAvailableRecharge'), value: available(item?.rechargeBalance, item?.frozenRecharge) },
    { label: $ts('module.system.member.walletAvailableGift'), value: available(item?.giftBalance, item?.frozenGift) },
    { label: $ts('module.system.member.totalRecharge'), value: item?.totalRecharge },
    { label: $ts('module.system.member.totalGift'), value: item?.totalGift },
    { label: $ts('module.system.member.totalConsume'), value: item?.totalConsume }
  ]
})

const profileItems = computed(() => {
  const item = props.data

  return [
    { label: $ts('module.system.member.userId'), value: item?.userId },
    { label: $ts('module.system.member.nickname'), value: item?.nickname },
    { label: $ts('module.system.member.username'), value: item?.username },
    { label: $ts('module.system.member.phone'), value: item?.phone },
    { label: $ts('module.system.member.email'), value: item?.email },
    { label: $ts('module.system.member.level'), value: item?.levelName },
    { label: $ts('module.system.member.inviteCode'), value: item?.inviteCode },
    { label: $ts('module.system.member.inviterId'), value: item?.inviterId },
    { label: $ts('module.system.member.invitedAt'), value: item?.invitedAt },
    { label: $ts('module.system.member.createdAt'), value: item?.createdAt },
    { label: $ts('module.system.member.remark'), value: item?.remark }
  ]
})

const loadLogs = async () => {
  if (!props.data?.userId) {
    logs.value = []
    return
  }

  logsLoading.value = true

  try {
    const result = await $trpc.sysMemberBalanceLog.page.query({
      page: 1,
      pageSize: 10,
      userId: props.data.userId
    })

    logs.value = (result.list ?? []) as BalanceLogItem[]
  } finally {
    logsLoading.value = false
  }
}

const openLogs = () => {
  if (!props.data?.userId) return

  // 跳转到流水页并按该会员过滤，便于继续查看完整历史
  navigateTo({ path: '/system/member-balance-log', query: { userId: props.data.userId } })
  visible.value = false
}

watch(visible, (opened) => {
  if (opened) {
    void loadLogs()
  }
})
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="$ts('module.system.member.detailTitle')"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[900px]', footer: 'justify-between' }"
  >
    <template #body>
      <div v-if="data" class="space-y-4">
        <div class="flex items-center gap-3">
          <span class="text-sm text-muted">{{ $ts('module.system.member.statusLabel') }}</span>
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border" :class="statusBadge.class">
            {{ statusBadge.label }}
          </span>
          <UBadge v-if="data.levelName" color="primary" variant="subtle">
            {{ data.levelName }}
          </UBadge>
        </div>

        <UCard variant="subtle" :ui="{ body: 'space-y-4' }">
          <div class="text-sm font-medium">{{ $ts('module.system.member.profileSection') }}</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <UFormField
              v-for="item in profileItems"
              :key="item.label"
              :label="item.label"
              orientation="horizontal"
              :ui="{ root: 'items-start', labelWrapper: 'w-28 shrink-0 pt-1', container: 'min-w-0 flex-1' }"
            >
              <UInput
                :model-value="displayValue(item.value)"
                readonly
                color="neutral"
                variant="subtle"
                class="w-full"
                :ui="{ base: 'break-all' }"
              />
            </UFormField>
          </div>
        </UCard>

        <UCard variant="subtle" :ui="{ body: 'space-y-4' }">
          <div class="text-sm font-medium">{{ $ts('module.system.member.walletSection') }}</div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">
            <UFormField
              v-for="item in walletItems"
              :key="item.label"
              :label="item.label"
              orientation="horizontal"
              :ui="{ root: 'items-start', labelWrapper: 'w-28 shrink-0 pt-1', container: 'min-w-0 flex-1' }"
            >
              <UInput :model-value="displayValue(item.value)" readonly color="neutral" variant="subtle" class="w-full" />
            </UFormField>
          </div>
        </UCard>

        <USeparator :label="$ts('module.system.member.recentLogs')" />

        <div v-if="logsLoading" class="py-4 text-center text-sm text-muted">
          <UIcon name="i-lucide-loader-circle" class="animate-spin" />
        </div>
        <div v-else-if="logs.length === 0" class="py-4 text-center text-sm text-muted">
          {{ $ts('module.system.member.noLogs') }}
        </div>
        <div v-else class="space-y-2 max-h-72 overflow-auto pr-1">
          <div
            v-for="log in logs"
            :key="String(log.id ?? log.createdAt ?? '')"
            class="rounded-md border border-default p-3 text-xs flex flex-wrap items-center gap-3"
          >
            <span class="text-muted">{{ log.createdAt }}</span>
            <span>{{ translate(memberAccountRecord, log.account) }}</span>
            <span>{{ translate(memberDirectionRecord, log.direction) }}</span>
            <span class="font-medium">{{ log.amount }}</span>
            <span class="text-muted">{{ translate(memberBizTypeRecord, log.bizType) }}</span>
            <span class="text-muted break-all">{{ log.bizNo }}</span>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <UButton v-if="data?.userId" color="neutral" variant="outline" icon="i-lucide-scroll-text" @click="openLogs">
        {{ $ts('module.system.member.viewAllLogs') }}
      </UButton>
      <UButton color="neutral" variant="subtle" @click="visible = false">
        {{ $ts('common.close') }}
      </UButton>
    </template>
  </UModal>
</template>
