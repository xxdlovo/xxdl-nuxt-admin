<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysMemberFreezeSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
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
              <span>{{ $ts('module.system.memberFreeze.title') }}</span>
            </template>
            <!-- 空默认插槽：冻结单由业务事务写入，管理端不提供新增/批量删除（同 pay-order 的处理方式） -->
            <template #default />
          </TableHeaderOperation>
        </template>
      </TableWithPagination>
    </UCard>

    <SysMemberFreezeRelease v-model:visible="releaseVisible" :data="releasingData ?? undefined" :refresh="refresh" />
    <SysMemberFreezeDetail v-model:visible="detailVisible" :data="detailData ?? undefined" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '消费冻结单',
  icon: 'i-lucide-snowflake'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysMemberFreezeDto, SysMemberFreezeQueryDTO } from '#shared/system/memberFreeze'
import { memberFreezeStatusConfig } from '#shared/constants/business'
import { customPermissionCode } from '#shared/auth'
import { usePaginatedTable, useBadgeColumn } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'
import SysMemberFreezeSearch from './components/sys-member-freeze-search.vue'
import SysMemberFreezeRelease from './components/sys-member-freeze-release.vue'
import SysMemberFreezeDetail from './components/sys-member-freeze-detail.vue'
import { useToastSuccess } from '~/utils/toast'

/** 冻结中的单据还占着会员余额，服务端禁止删除，列表里同样不给删除入口 */
const FROZEN_STATUS = 'FROZEN'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const freezePermissions = useCrudPermissions('system:memberFreeze')
const { isAdmin, hasPermission } = useRbacProfile()
// 释放会把预扣余额退回会员，属独立授权位，不在标准 CRUD codes 里
const releasePermissionCode = customPermissionCode('system:memberFreeze', 'release')
const canRelease = computed(() => isAdmin.value || hasPermission(releasePermissionCode))
const searchParams = ref<SysMemberFreezeQueryDTO>({})

const detailVisible = ref(false)
const detailData = ref<SysMemberFreezeDto | null>(null)
const releaseVisible = ref(false)
const releasingData = ref<SysMemberFreezeDto | null>(null)

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysMemberFreezeDto>({
  query: params => $trpc.sysMemberFreeze.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

const handleDetail = (row: SysMemberFreezeDto) => {
  detailData.value = row
  detailVisible.value = true
}

const handleOpenRelease = (row: SysMemberFreezeDto) => {
  releasingData.value = row
  releaseVisible.value = true
}

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysMemberFreeze.remove.mutate(id)
  useToastSuccess($ts('common.deleteSuccess'))
  await refresh()
}

const columns = computed<TableColumn<SysMemberFreezeDto>[]>(() => {
  const actionColumn: TableColumn<SysMemberFreezeDto> = {
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

      if (canRelease.value && row.original.status === FROZEN_STATUS) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'warning',
          size: 'xs',
          onClick: () => handleOpenRelease(row.original)
        }, { default: () => $ts('module.system.memberFreeze.release') }))
      }

      if (freezePermissions.canDel.value && row.original.status !== FROZEN_STATUS) {
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
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => h('span', { class: 'text-muted' }, (pagination.page - 1) * pagination.pageSize + row.index + 1)
    },
    {
      accessorKey: 'bizNo',
      header: () => $ts('module.system.memberFreeze.bizNo')
    },
    {
      accessorKey: 'userId',
      header: () => $ts('module.system.memberFreeze.userId')
    },
    {
      accessorKey: 'amount',
      header: () => $ts('module.system.memberFreeze.amount')
    },
    {
      accessorKey: 'giftAmount',
      header: () => $ts('module.system.memberFreeze.giftAmount')
    },
    {
      accessorKey: 'rechargeAmount',
      header: () => $ts('module.system.memberFreeze.rechargeAmount')
    },
    useBadgeColumn<SysMemberFreezeDto>('status', 'module.system.memberFreeze.statusLabel', memberFreezeStatusConfig, 0),
    {
      accessorKey: 'subject',
      header: () => $ts('module.system.memberFreeze.subject')
    },
    {
      accessorKey: 'createdAt',
      header: () => $ts('module.system.memberFreeze.createdAt')
    },
    {
      accessorKey: 'expireAt',
      header: () => $ts('module.system.memberFreeze.expireAt')
    },
    ...(freezePermissions.canOperate.value || canRelease.value || freezePermissions.canList.value ? [actionColumn] : [])
  ]
})

onMounted(async () => {
  await search()
})
</script>
