<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysMemberBalanceLogSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
    </div>

    <!-- 区间汇总：按业务类型聚合，便于财务快速核对 -->
    <div class="flex-shrink-0 grid grid-cols-2 md:grid-cols-4 gap-3">
      <UCard :ui="{ body: 'p-3' }">
        <div class="text-xs text-muted">{{ $ts('module.system.memberBalanceLog.totalIn') }}</div>
        <div class="mt-1 text-lg font-semibold">{{ summary.totalIn }}</div>
      </UCard>
      <UCard :ui="{ body: 'p-3' }">
        <div class="text-xs text-muted">{{ $ts('module.system.memberBalanceLog.totalOut') }}</div>
        <div class="mt-1 text-lg font-semibold">{{ summary.totalOut }}</div>
      </UCard>
      <UCard :ui="{ body: 'p-3' }">
        <div class="text-xs text-muted">{{ $ts('module.system.memberBalanceLog.netTotal') }}</div>
        <div class="mt-1 text-lg font-semibold">{{ summary.netTotal }}</div>
      </UCard>
      <UCard :ui="{ body: 'p-3' }">
        <div class="text-xs text-muted">{{ $ts('module.system.memberBalanceLog.pendingRecharge') }}</div>
        <div class="mt-1 flex items-center gap-2">
          <span class="text-lg font-semibold">{{ pendingRechargeCount }}</span>
          <UButton
            v-if="canReconcile"
            size="xs"
            variant="outline"
            color="warning"
            :loading="retrying"
            :disabled="pendingRechargeCount === 0"
            @click="handleRetry"
          >
            {{ $ts('module.system.memberBalanceLog.rechargeRetry') }}
          </UButton>
        </div>
      </UCard>
    </div>

    <UCard class="flex-1 min-h-0 flex flex-col overflow-hidden" :ui="{ body: 'flex flex-col h-full p-0 sm:p-0' }">
      <TableWithPagination
        ref="table"
        :data="data"
        :columns="columns"
        :loading="loading"
        :pagination="pagination"
        :page-size-options="pageSizeOptions"
      >
        <template #header>
          <TableHeaderOperation
            v-if="tableRef?.tableRef"
            :table-ref="tableRef.tableRef"
            :loading="loading"
            class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
            @refresh="refresh"
          >
            <template #prefix>
              <span>{{ $ts('module.system.memberBalanceLog.title') }}</span>
            </template>
            <!-- 流水是资金凭证：不提供新增/编辑/删除 -->
            <template #default>
              <div class="flex flex-wrap items-center gap-2">
                <UButton
                  v-if="canReconcile"
                  size="xs"
                  variant="outline"
                  color="neutral"
                  icon="i-lucide-scale"
                  :loading="reconciling"
                  @click="handleReconcile"
                >
                  {{ $ts('module.system.memberBalanceLog.reconcile') }}
                </UButton>
                <UButton
                  v-if="canExport"
                  size="xs"
                  variant="outline"
                  color="primary"
                  icon="i-lucide-download"
                  :loading="exporting"
                  @click="handleExport"
                >
                  {{ $ts('module.system.memberBalanceLog.export') }}
                </UButton>
              </div>
            </template>
          </TableHeaderOperation>
        </template>
      </TableWithPagination>
    </UCard>

    <SysMemberBalanceLogDetail v-model:visible="detailVisible" :data="detailTarget ?? undefined" />

    <!-- 对账结果：只在有差异或用户主动查看时展示 -->
    <UModal
      v-model:open="reconcileVisible"
      :title="$ts('module.system.memberBalanceLog.reconcileTitle')"
      :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[760px]', footer: 'justify-end' }"
    >
      <template #body>
        <div class="space-y-3">
          <div class="text-sm text-muted">
            {{ $ts('module.system.memberBalanceLog.checkedCount') }}：{{ reconcileResult.checkedCount }}
          </div>

          <UAlert
            v-if="reconcileResult.mismatches.length === 0"
            color="success"
            variant="subtle"
            icon="i-lucide-circle-check"
            :title="$ts('module.system.memberBalanceLog.noMismatch')"
            :description="$ts('module.system.memberBalanceLog.noMismatchDesc')"
          />

          <template v-else>
            <UAlert
              color="error"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              :title="$ts('module.system.memberBalanceLog.mismatchTitle')"
              :description="$ts('module.system.memberBalanceLog.mismatchDesc', { count: String(reconcileResult.mismatches.length) })"
            />
            <div class="max-h-72 overflow-auto space-y-2">
              <div
                v-for="item in reconcileResult.mismatches"
                :key="`${item.userId}:${item.account}`"
                class="rounded-md border border-default p-3 text-xs flex flex-wrap gap-4"
              >
                <span class="break-all">{{ $ts('module.system.memberBalanceLog.userId') }}: {{ item.userId }}</span>
                <span>{{ $ts('module.system.memberBalanceLog.account') }}: {{ translate(memberAccountRecord, item.account) }}</span>
                <span>{{ $ts('module.system.memberBalanceLog.walletTotal') }}: {{ item.walletTotal }}</span>
                <span>{{ $ts('module.system.memberBalanceLog.ledgerTotal') }}: {{ item.ledgerTotal }}</span>
                <span class="text-error">{{ $ts('module.system.memberBalanceLog.diff') }}: {{ item.diff }}</span>
              </div>
            </div>
          </template>
        </div>
      </template>

      <template #footer>
        <UButton color="neutral" variant="subtle" @click="reconcileVisible = false">
          {{ $ts('common.close') }}
        </UButton>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '余额流水',
  icon: 'i-lucide-scroll-text'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysMemberBalanceLogDto, SysMemberBalanceLogQueryDTO } from '#shared/system/memberBalanceLog'
import { memberAccountRecord, memberBizTypeRecord, memberDirectionRecord } from '#shared/constants/business'
import { usePaginatedTable } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'
import { useToastSuccess, useToastWarning } from '~/utils/toast'
import { downloadTextFile } from '~/utils/download'
import SysMemberBalanceLogSearch from './components/sys-member-balance-log-search.vue'
import SysMemberBalanceLogDetail from './components/sys-member-balance-log-detail.vue'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const route = useRoute()
const tableRef = useTemplateRef('table')
const { isAdmin, hasPermission } = useRbacProfile()

const canReconcile = computed(() => isAdmin.value || hasPermission('system:memberBalanceLog:reconcile'))
const canExport = computed(() => isAdmin.value || hasPermission('system:memberBalanceLog:export'))

// 从会员详情「查看全部流水」跳转过来时按会员过滤
const searchParams = ref<SysMemberBalanceLogQueryDTO>({
  userId: typeof route.query.userId === 'string' ? route.query.userId : undefined
})

const detailVisible = ref(false)
const detailTarget = ref<SysMemberBalanceLogDto | null>(null)

const summary = ref({ totalIn: '0.00', totalOut: '0.00', netTotal: '0.00' })
const pendingRechargeCount = ref(0)
const reconciling = ref(false)
const reconcileVisible = ref(false)
const exporting = ref(false)
const retrying = ref(false)
const reconcileResult = ref<{ checkedCount: number, mismatches: Array<{ userId: string, account: string, walletTotal: string, ledgerTotal: string, diff: string }> }>({
  checkedCount: 0,
  mismatches: []
})

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysMemberBalanceLogDto>({
  query: params => $trpc.sysMemberBalanceLog.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

const translate = (record: Record<string, string>, value?: string | null) => {
  if (!value) return '-'
  const key = record[value]

  return key ? $ts(key) : value
}

/**
 * 汇总与待补偿数量：跟随搜索条件刷新。
 * `pendingRechargeCount` 由 summary 一并下发（服务端一次 COUNT(*)），
 * 全量对账（reconcile）开销大，已收敛到「对账」按钮（见 handleReconcile），页面加载不再触发。
 */
const loadSummary = async () => {
  const summaryResult = await $trpc.sysMemberBalanceLog.summary.query({
    createdFrom: searchParams.value.createdFrom ?? null,
    createdTo: searchParams.value.createdTo ?? null
  })

  summary.value = {
    totalIn: summaryResult.totalIn,
    totalOut: summaryResult.totalOut,
    netTotal: summaryResult.netTotal
  }

  pendingRechargeCount.value = summaryResult.pendingRechargeCount
}

const handleDetail = (row: SysMemberBalanceLogDto) => {
  detailTarget.value = row
  detailVisible.value = true
}

const handleReconcile = async () => {
  reconciling.value = true

  try {
    const result = await $trpc.sysMemberBalanceLog.reconcile.query({
      userId: searchParams.value.userId ?? null,
      checkDate: null
    })

    reconcileResult.value = {
      checkedCount: result.checkedCount,
      mismatches: result.mismatches as typeof reconcileResult.value.mismatches
    }
    pendingRechargeCount.value = result.pendingRechargeCount
    reconcileVisible.value = true
  } finally {
    reconciling.value = false
  }
}

const handleExport = async () => {
  exporting.value = true

  try {
    const result = await $trpc.sysMemberBalanceLog.export.query({
      userId: searchParams.value.userId ?? null,
      account: searchParams.value.account ?? null,
      direction: searchParams.value.direction ?? null,
      bizType: searchParams.value.bizType ?? null,
      bizNo: searchParams.value.bizNo ?? null,
      createdFrom: searchParams.value.createdFrom ?? null,
      createdTo: searchParams.value.createdTo ?? null,
      limit: 5000
    })

    downloadTextFile(result.filename, result.content)
    useToastSuccess($ts('module.system.memberBalanceLog.exportSuccess'))
  } finally {
    exporting.value = false
  }
}

const handleRetry = async () => {
  retrying.value = true

  try {
    const result = await $trpc.sysMemberBalanceLog.rechargeRetry.mutate({
      outTradeNo: null,
      userId: null,
      createdFrom: null,
      createdTo: null
    })

    const failed = result.results.filter(item => !item.ok)

    if (failed.length === 0) {
      useToastSuccess($ts('module.system.memberBalanceLog.retryDone', { count: String(result.results.length) }))
    } else {
      useToastWarning($ts('module.system.memberBalanceLog.retryPartial', { count: String(failed.length) }))
    }

    await Promise.all([refresh(), loadSummary()])
  } finally {
    retrying.value = false
  }
}

const columns = computed<TableColumn<SysMemberBalanceLogDto>[]>(() => [
  {
    id: 'index',
    header: () => $ts('common.index'),
    cell: ({ row }) => h('span', { class: 'text-muted' }, (pagination.page - 1) * pagination.pageSize + row.index + 1)
  },
  {
    accessorKey: 'createdAt',
    header: () => $ts('module.system.memberBalanceLog.createdAt')
  },
  {
    accessorKey: 'userId',
    header: () => $ts('module.system.memberBalanceLog.userId')
  },
  {
    accessorKey: 'account',
    header: () => $ts('module.system.memberBalanceLog.account'),
    cell: ({ row }) => translate(memberAccountRecord, row.original.account)
  },
  {
    accessorKey: 'direction',
    header: () => $ts('module.system.memberBalanceLog.direction'),
    cell: ({ row }) => translate(memberDirectionRecord, row.original.direction)
  },
  {
    accessorKey: 'amount',
    header: () => $ts('module.system.memberBalanceLog.amount')
  },
  {
    id: 'balance',
    header: () => $ts('module.system.memberBalanceLog.balanceAfter'),
    cell: ({ row }) => h('span', {}, `${row.original.balanceBefore ?? '-'} → ${row.original.balanceAfter ?? '-'}`)
  },
  {
    accessorKey: 'bizType',
    header: () => $ts('module.system.memberBalanceLog.bizType'),
    cell: ({ row }) => translate(memberBizTypeRecord, row.original.bizType)
  },
  {
    accessorKey: 'bizNo',
    header: () => $ts('module.system.memberBalanceLog.bizNo')
  },
  {
    accessorKey: 'reason',
    header: () => $ts('module.system.memberBalanceLog.reason'),
    cell: ({ row }) => row.original.reason || '-'
  },
  {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')

      return h('div', { class: 'flex gap-2' }, [
        h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          onClick: () => handleDetail(row.original)
        }, { default: () => $ts('common.detail') })
      ])
    }
  }
])

onMounted(async () => {
  await Promise.all([search(), loadSummary()])
})
</script>
