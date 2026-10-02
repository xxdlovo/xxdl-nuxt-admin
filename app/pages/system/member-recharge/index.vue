<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysMemberRechargeSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
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
            :add-permission="rechargePermissions.codes.add"
            :delete-permission="rechargePermissions.codes.del"
            :add-label="$ts('module.system.memberRecharge.manualAdd')"
            add-icon="i-lucide-hand-coins"
            class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
            @add="handleAdd"
            @delete="handleBatchDelete"
            @refresh="refresh"
          >
            <template #prefix>
              <span>{{ $ts('module.system.memberRecharge.title') }}</span>
            </template>
          </TableHeaderOperation>
        </template>
      </TableWithPagination>
    </UCard>

    <!-- 弹窗放在 TableHeaderOperation 之外：填了默认插槽会顶掉组件内置的新增/批量删除按钮 -->
    <SysMemberRechargeAdd v-model:visible="addVisible" :refresh="refresh" />
    <SysMemberRechargeClose v-model:visible="closeVisible" :data="closingData ?? undefined" :refresh="refresh" />
    <SysMemberRechargeDetail v-model:visible="detailVisible" :data="detailData ?? undefined" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '充值记录',
  icon: 'i-lucide-hand-coins'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysMemberRechargeDto, SysMemberRechargeQueryDTO } from '#shared/system/memberRecharge'
import { memberRechargeStatusConfig, payChannelCodeRecord } from '#shared/constants/business'
import { customPermissionCode } from '#shared/auth'
import { usePaginatedTable, useBadgeColumn, useSelectionColumn } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'
import SysMemberRechargeSearch from './components/sys-member-recharge-search.vue'
import SysMemberRechargeAdd from './components/sys-member-recharge-add.vue'
import SysMemberRechargeClose from './components/sys-member-recharge-close.vue'
import SysMemberRechargeDetail from './components/sys-member-recharge-detail.vue'
import { useToastSuccess } from '~/utils/toast'

/** 已到账的充值单是入账凭证，服务端禁止修改与删除，列表里同样不给删除入口 */
const CREDITED_STATUS = 'OD'
/** 只有待支付可以关闭（与领域层 markClosed 的守卫一致） */
const CLOSABLE_STATUS = 'WP'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const rechargePermissions = useCrudPermissions('system:memberRecharge')
const { isAdmin, hasPermission } = useRbacProfile()
// 关闭会释放占用的优惠码，属独立授权位，不在标准 CRUD codes 里
const closePermissionCode = customPermissionCode('system:memberRecharge', 'close')
const canClose = computed(() => isAdmin.value || hasPermission(closePermissionCode))
const searchParams = ref<SysMemberRechargeQueryDTO>({})

const detailVisible = ref(false)
const detailData = ref<SysMemberRechargeDto | null>(null)
const addVisible = ref(false)
const closeVisible = ref(false)
const closingData = ref<SysMemberRechargeDto | null>(null)

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysMemberRechargeDto>({
  query: params => $trpc.sysMemberRecharge.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

const checkedRowKeys = ref<string[]>([])
const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysMemberRechargeDto>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

const channelLabel = (code?: string | null) => {
  if (!code) return ''
  const key = payChannelCodeRecord[code]
  return key ? $ts(key) : code
}

const handleAdd = () => {
  addVisible.value = true
}

const handleDetail = (row: SysMemberRechargeDto) => {
  detailData.value = row
  detailVisible.value = true
}

const handleOpenClose = (row: SysMemberRechargeDto) => {
  closingData.value = row
  closeVisible.value = true
}

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysMemberRecharge.remove.mutate(id)
  useToastSuccess($ts('common.deleteSuccess'))
  await refresh()
}

const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) {
    return
  }

  await $trpc.sysMemberRecharge.batchDelete.mutate(checkedRowKeys.value)
  useToastSuccess($ts('common.deleteSuccess'))
  checkedRowKeys.value = []
  await refresh()
}

const columns = computed<TableColumn<SysMemberRechargeDto>[]>(() => {
  const actionColumn: TableColumn<SysMemberRechargeDto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      actions.push(h(UButton, {
        variant: 'outline',
        color: 'primary',
        size: 'xs',
        onClick: () => handleDetail(row.original)
      }, { default: () => $ts('common.detail') }))

      if (canClose.value && row.original.status === CLOSABLE_STATUS) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'warning',
          size: 'xs',
          onClick: () => handleOpenClose(row.original)
        }, { default: () => $ts('module.system.memberRecharge.close') }))
      }

      if (rechargePermissions.canDel.value && row.original.status !== CREDITED_STATUS) {
        actions.push(h(Popconfirm, {
          onConfirm: () => handleDelete(row.original.id as string)
        }, {
          trigger: () => h(UButton, {
            variant: 'outline',
            color: 'error',
            size: 'xs'
          }, { default: () => $ts('common.delete') })
        }))
      }

      return h('div', { class: 'flex gap-2' }, actions)
    }
  }

  return [
    ...(rechargePermissions.canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => h('span', { class: 'text-muted' }, (pagination.page - 1) * pagination.pageSize + row.index + 1)
    },
    {
      accessorKey: 'outTradeNo',
      header: () => $ts('module.system.memberRecharge.outTradeNo')
    },
    {
      accessorKey: 'userId',
      header: () => $ts('module.system.memberRecharge.userId')
    },
    {
      accessorKey: 'amount',
      header: () => $ts('module.system.memberRecharge.amount')
    },
    {
      accessorKey: 'giftAmount',
      header: () => $ts('module.system.memberRecharge.giftAmount')
    },
    {
      accessorKey: 'discountAmount',
      header: () => $ts('module.system.memberRecharge.discountAmount')
    },
    {
      accessorKey: 'payAmount',
      header: () => $ts('module.system.memberRecharge.payAmount')
    },
    {
      accessorKey: 'couponCode',
      header: () => $ts('module.system.memberRecharge.couponCode')
    },
    useBadgeColumn<SysMemberRechargeDto>('status', 'module.system.memberRecharge.statusLabel', memberRechargeStatusConfig, 0),
    {
      accessorKey: 'payChannelCode',
      header: () => $ts('module.system.memberRecharge.payChannelCode'),
      cell: ({ row }) => channelLabel(row.original.payChannelCode)
    },
    {
      accessorKey: 'paidAt',
      header: () => $ts('module.system.memberRecharge.paidAt')
    },
    {
      accessorKey: 'creditedAt',
      header: () => $ts('module.system.memberRecharge.creditedAt')
    },
    ...(rechargePermissions.canOperate.value || canClose.value || rechargePermissions.canList.value ? [actionColumn] : [])
  ]
})

onMounted(async () => {
  await search()
})
</script>
