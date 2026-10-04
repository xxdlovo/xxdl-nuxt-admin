<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysMemberLevelOrderSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
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
            :disabled-delete="checkedRowKeys.length === 0 || loading"
            :selected-count="checkedRowKeys.length"
            class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
            @refresh="refresh"
          >
            <template #prefix>
              <span>{{ $ts('module.system.memberLevelOrder.title') }}</span>
            </template>
            <!-- 开通单是资金凭证：没有「新增」，批量删除也只对已关闭/失败的单开放 -->
            <template #default>
              <Popconfirm
                v-permission="orderPermissions.codes.del"
                :content="$ts('common.confirmDelete', { count: deletableCheckedKeys.length })"
                :positive-text="$ts('common.confirm')"
                :loading="loading"
                @confirm="handleBatchDelete"
              >
                <template #trigger>
                  <UButton
                    variant="outline"
                    color="error"
                    icon="i-ic-round-delete"
                    :disabled="deletableCheckedKeys.length === 0 || loading"
                  >
                    {{ $ts('common.batchDelete') }}
                  </UButton>
                </template>
              </Popconfirm>
            </template>
          </TableHeaderOperation>
        </template>
      </TableWithPagination>
    </UCard>

    <!-- 弹窗放在 TableHeaderOperation 之外：填了默认插槽会顶掉组件内置的新增/批量删除按钮 -->
    <SysMemberLevelOrderDetail v-model:visible="detailVisible" :data="detailData" />
    <SysMemberLevelOrderClose v-model:visible="closeVisible" :data="closingData" :refresh="refresh" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '会员开通记录',
  // 与菜单 SQL（...1061）保持一致：会员等级用 crown，开通记录用 receipt
  icon: 'i-lucide-receipt'
})

import type { Component } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import { payOrderStatusConfig } from '#shared/constants/business'
import { customPermissionCode } from '#shared/auth'
import { usePaginatedTable, useBadgeColumn, useSelectionColumn } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'
import CopyValueBadge from '~/components/base/CopyValueBadge.vue'
import { useToastError, useToastSuccess } from '~/utils/toast'
import SysMemberLevelOrderSearch from './components/sys-member-level-order-search.vue'
import SysMemberLevelOrderDetail from './components/sys-member-level-order-detail.vue'
import SysMemberLevelOrderClose from './components/sys-member-level-order-close.vue'
import {
  memberLevelOrderPayModeRecord,
  type MemberLevelOrderDetail,
  type MemberLevelOrderQuery
} from './components/types'

/** 只有待支付可以同步 / 关闭（与领域层守卫一致） */
const PENDING_STATUS = 'WP'
/** 已关闭 / 失败的单据才允许删除（生效中的单据是会员权益凭证） */
const DELETABLE_STATUSES = ['CL', 'FL']

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const orderPermissions = useCrudPermissions('system:memberLevelOrder')
const { isAdmin, hasPermission } = useRbacProfile()
// 同步状态会调用渠道查询并推进本地单据状态，属独立授权位（:query）
const syncPermissionCode = customPermissionCode('system:memberLevelOrder', 'query')
const canSync = computed(() => isAdmin.value || hasPermission(syncPermissionCode))
const searchParams = ref<MemberLevelOrderQuery>({})

const detailVisible = ref(false)
const detailData = ref<MemberLevelOrderDetail | null>(null)
const closeVisible = ref(false)
const closingData = ref<MemberLevelOrderDetail | null>(null)
const syncingId = ref('')

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<MemberLevelOrderDetail>({
  // 服务端返回联表字段（会员昵称 / 手机号、关联支付单），类型以后端契约为准
  query: params => $trpc.sysMemberLevelOrder.page.query(params) as unknown as Promise<{
    list: MemberLevelOrderDetail[]
    total: number
    page: number
    pageSize: number
  }>,
  pageSizeOptions: [10, 20, 50, 100]
})

const checkedRowKeys = ref<string[]>([])
const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<MemberLevelOrderDetail>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

const payModeLabel = (mode?: string | null) => {
  if (!mode) return '-'
  const key = memberLevelOrderPayModeRecord[mode]

  return key ? $ts(key) : mode
}

const memberLabel = (row: MemberLevelOrderDetail) => {
  const name = row.nickname || row.username || ''

  return {
    name: name || row.userId || '-',
    sub: name ? (row.userId || '') : ''
  }
}

/** 生效区间：endAt 为空 = 长期 */
const periodLabel = (row: MemberLevelOrderDetail) => {
  const start = row.startAt || '-'
  const end = row.endAt || $ts('module.system.memberLevelOrder.longTerm')

  return `${start} ~ ${end}`
}

const canDelete = (row: MemberLevelOrderDetail) => DELETABLE_STATUSES.includes(String(row.status ?? ''))

/**
 * 批量删除同样只对「已关闭 / 失败」生效：先按状态过滤选中的行，
 * 避免把必然被服务端拒绝（`deleteNotAllowed`）的请求发出去。
 */
const deletableCheckedKeys = computed(() => data.value
  .filter(row => canDelete(row) && row.id && checkedRowKeys.value.includes(String(row.id)))
  .map(row => String(row.id)))

const handleDetail = (row: MemberLevelOrderDetail) => {
  detailData.value = row
  detailVisible.value = true
}

const handleOpenClose = (row: MemberLevelOrderDetail) => {
  closingData.value = row
  closeVisible.value = true
}

/** 同步状态：向渠道查询并推进本地单据（可能直接生效） */
const handleSync = async (row: MemberLevelOrderDetail) => {
  if (!row.id || syncingId.value) return

  syncingId.value = String(row.id)

  try {
    const result = await $trpc.sysMemberLevelOrder.sync.mutate({ id: String(row.id) }) as { status?: string | null, failReason?: string | null } | null
    const status = result?.status ?? row.status

    if (status === 'OD') {
      useToastSuccess($ts('module.system.memberLevelOrder.syncPaid'))
    } else {
      useToastSuccess($ts('module.system.memberLevelOrder.syncDone'), undefined, result?.failReason ?? undefined)
    }

    await refresh()
  } catch (error) {
    useToastError($ts('module.system.memberLevelOrder.syncFailed'), undefined, error instanceof Error ? error.message : '')
  } finally {
    syncingId.value = ''
  }
}

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysMemberLevelOrder.remove.mutate(id)
  useToastSuccess($ts('common.deleteSuccess'))
  await refresh()
}

const handleBatchDelete = async () => {
  if (loading.value || deletableCheckedKeys.value.length === 0) {
    return
  }

  await $trpc.sysMemberLevelOrder.batchDelete.mutate(deletableCheckedKeys.value)
  useToastSuccess($ts('common.deleteSuccess'))
  checkedRowKeys.value = []
  await refresh()
}

const columns = computed<TableColumn<MemberLevelOrderDetail>[]>(() => {
  const actionColumn: TableColumn<MemberLevelOrderDetail> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const item = row.original
      const actions = []

      actions.push(h(UButton, {
        variant: 'outline',
        color: 'primary',
        size: 'xs',
        onClick: () => handleDetail(item)
      }, { default: () => $ts('common.detail') }))

      if (canSync.value && item.status === PENDING_STATUS) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'neutral',
          size: 'xs',
          loading: syncingId.value === item.id,
          onClick: () => handleSync(item)
        }, { default: () => $ts('module.system.memberLevelOrder.sync') }))
      }

      if (orderPermissions.canEdit.value && item.status === PENDING_STATUS) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'warning',
          size: 'xs',
          onClick: () => handleOpenClose(item)
        }, { default: () => $ts('module.system.memberLevelOrder.close') }))
      }

      // 生效中的单据不允许删除（服务端同样拦截），前端按状态禁用入口
      if (orderPermissions.canDel.value && canDelete(item)) {
        actions.push(h(Popconfirm, {
          onConfirm: () => handleDelete(String(item.id ?? ''))
        }, {
          trigger: () => h(UButton, {
            variant: 'outline',
            color: 'error',
            size: 'xs'
          }, { default: () => $ts('common.delete') })
        }))
      }

      return h('div', { class: 'flex flex-wrap gap-2' }, actions)
    }
  }

  return [
    ...(orderPermissions.canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => h('span', { class: 'text-muted' }, (pagination.page - 1) * pagination.pageSize + row.index + 1)
    },
    {
      accessorKey: 'outTradeNo',
      header: () => $ts('module.system.memberLevelOrder.outTradeNo'),
      // 单号是排查问题的入口：点一下即可复制
      cell: ({ row }) => row.original.outTradeNo
        ? h(CopyValueBadge, {
            label: '',
            value: String(row.original.outTradeNo),
            color: 'primary',
            icon: 'i-lucide-receipt-text'
          })
        : h('span', { class: 'text-muted' }, '-')
    },
    {
      id: 'member',
      header: () => $ts('module.system.memberLevelOrder.member'),
      cell: ({ row }) => {
        const info = memberLabel(row.original)

        return h('div', { class: 'flex flex-col' }, [
          h('span', {}, info.name),
          info.sub ? h('span', { class: 'text-xs text-muted' }, info.sub) : null
        ])
      }
    },
    {
      accessorKey: 'levelName',
      header: () => $ts('module.system.memberLevelOrder.levelName'),
      cell: ({ row }) => row.original.levelName || row.original.levelId || '-'
    },
    {
      id: 'payMode',
      header: () => $ts('module.system.memberLevelOrder.payModeLabel'),
      cell: ({ row }) => payModeLabel(row.original.payMode)
    },
    {
      id: 'amount',
      header: () => $ts('module.system.memberLevelOrder.amount'),
      cell: ({ row }) => h('div', { class: 'flex flex-col text-xs' }, [
        h('span', {}, `${$ts('module.system.memberLevelOrder.priceAmount')}: ${row.original.priceAmount ?? '-'}`),
        h('span', { class: 'text-muted' }, `${$ts('module.system.memberLevelOrder.payAmount')}: ${row.original.payAmount ?? '-'}`)
      ])
    },
    useBadgeColumn<MemberLevelOrderDetail>('status', 'module.system.memberLevelOrder.statusLabel', payOrderStatusConfig, 0),
    {
      accessorKey: 'payOrderId',
      header: () => $ts('module.system.memberLevelOrder.payOrderId'),
      cell: ({ row }) => row.original.payOrderId || '-'
    },
    {
      id: 'period',
      header: () => $ts('module.system.memberLevelOrder.period'),
      cell: ({ row }) => h('span', { class: 'text-xs' }, periodLabel(row.original))
    },
    {
      accessorKey: 'createdAt',
      header: () => $ts('module.system.memberLevelOrder.createdAt')
    },
    ...(orderPermissions.canOperate.value || canSync.value || orderPermissions.canList.value ? [actionColumn] : [])
  ]
})

onMounted(async () => {
  await search()
})
</script>
