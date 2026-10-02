<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysMemberSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
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
            :add-permission="memberPermissions.codes.add"
            :delete-permission="memberPermissions.codes.del"
            class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
            @add="handleAdd"
            @delete="handleBatchDelete"
            @refresh="refresh"
          >
            <template #prefix>
              <span>{{ $ts('module.system.member.title') }}</span>
            </template>
          </TableHeaderOperation>
        </template>
      </TableWithPagination>
    </UCard>

    <!-- 弹窗放在 TableHeaderOperation 之外：填了默认插槽会顶掉组件内置的新增/批量删除按钮 -->
    <SysMemberOperate v-model:visible="drawerVisible" :data="editingData ?? undefined" @saved="refresh" />
    <SysMemberDetail v-model:visible="detailVisible" :data="detailTarget ?? undefined" />
    <SysMemberAdjust v-model:visible="adjustVisible" :data="adjustTarget ?? undefined" @saved="refresh" />
    <SysMemberGrant v-model:visible="grantVisible" :data="grantTarget ?? undefined" @saved="refresh" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '会员管理',
  icon: 'i-lucide-users-round'
})

import type { Component } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysMemberQueryDTO } from '#shared/system/member'
import { memberStatusConfig } from '#shared/constants/business'
import { usePaginatedTable, useTableOperate, useBadgeColumn, useSelectionColumn } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'
import { useToastSuccess } from '~/utils/toast'
import SysMemberSearch from './components/sys-member-search.vue'
import SysMemberOperate from './components/sys-member-operate.vue'
import SysMemberDetail from './components/sys-member-detail.vue'
import SysMemberAdjust from './components/sys-member-adjust.vue'
import SysMemberGrant from './components/sys-member-grant.vue'
import type { MemberProfileRow } from './components/types'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const memberPermissions = useCrudPermissions('system:member')
const { isAdmin, hasPermission } = useRbacProfile()
const searchParams = ref<SysMemberQueryDTO>({})

// 资金类动作单独授权，便于客服等角色只读
const canAdjust = computed(() => isAdmin.value || hasPermission('system:member:adjust'))
const canGrant = computed(() => isAdmin.value || hasPermission('system:member:grant'))
const canChangeLevel = computed(() => isAdmin.value || hasPermission('system:member:level'))

const detailVisible = ref(false)
const detailTarget = ref<MemberProfileRow | null>(null)
const adjustVisible = ref(false)
const adjustTarget = ref<MemberProfileRow | null>(null)
const grantVisible = ref(false)
const grantTarget = ref<MemberProfileRow | null>(null)

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<MemberProfileRow>({
  // 服务端返回联表字段（昵称/等级/钱包），类型以 MemberProfileRow 为准
  query: params => $trpc.sysMember.page.query(params) as unknown as Promise<{
    list: MemberProfileRow[]
    total: number
    page: number
    pageSize: number
  }>,
  pageSizeOptions: [10, 20, 50, 100]
})

const { editingData, drawerVisible, checkedRowKeys, handleAdd, handleEdit } = useTableOperate<MemberProfileRow>({
  data,
  idKey: 'id',
  refresh
})

const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<MemberProfileRow>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

const handleDetail = (row: MemberProfileRow) => {
  detailTarget.value = row
  detailVisible.value = true
}

const handleAdjust = (row: MemberProfileRow) => {
  adjustTarget.value = row
  adjustVisible.value = true
}

const handleGrant = (row: MemberProfileRow) => {
  grantTarget.value = row
  grantVisible.value = true
}

const handleDelete = async (id: string) => {
  if (loading.value) return

  await $trpc.sysMember.remove.mutate(id)
  useToastSuccess($ts('common.deleteSuccess'))
  await refresh()
}

const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) {
    return
  }

  await $trpc.sysMember.batchDelete.mutate(checkedRowKeys.value)
  useToastSuccess($ts('common.deleteSuccess'))
  checkedRowKeys.value = []
  await refresh()
}

const columns = computed<TableColumn<MemberProfileRow>[]>(() => {
  const actionColumn: TableColumn<MemberProfileRow> = {
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

      if (canAdjust.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'warning',
          size: 'xs',
          onClick: () => handleAdjust(row.original)
        }, { default: () => $ts('module.system.member.adjust') }))
      }

      if (canGrant.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'success',
          size: 'xs',
          onClick: () => handleGrant(row.original)
        }, { default: () => $ts('module.system.member.grant') }))
      }

      if (memberPermissions.canEdit.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'neutral',
          size: 'xs',
          onClick: () => handleEdit(row.original.id as string)
        }, { default: () => $ts('common.edit') }))
      }

      if (memberPermissions.canDel.value) {
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

      return h('div', { class: 'flex flex-wrap gap-2' }, actions)
    }
  }

  return [
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => h('span', { class: 'text-muted' }, (pagination.page - 1) * pagination.pageSize + row.index + 1)
    },
    {
      id: 'member',
      header: () => $ts('module.system.member.nickname'),
      cell: ({ row }) => h('div', { class: 'flex flex-col' }, [
        h('span', {}, row.original.nickname || '-'),
        h('span', { class: 'text-xs text-muted' }, row.original.username || row.original.userId || '')
      ])
    },
    {
      accessorKey: 'levelName',
      header: () => $ts('module.system.member.level'),
      cell: ({ row }) => row.original.levelName || '-'
    },
    {
      id: 'wallet',
      header: () => $ts('module.system.member.walletSection'),
      cell: ({ row }) => h('div', { class: 'flex flex-col text-xs' }, [
        h('span', {}, `${$ts('module.system.member.walletRecharge')}: ${row.original.rechargeBalance ?? '0.00'}`),
        h('span', { class: 'text-muted' }, `${$ts('module.system.member.walletGift')}: ${row.original.giftBalance ?? '0.00'}`)
      ])
    },
    {
      id: 'frozen',
      header: () => $ts('module.system.member.walletFrozenRecharge'),
      cell: ({ row }) => h('div', { class: 'flex flex-col text-xs' }, [
        h('span', {}, `${row.original.frozenRecharge ?? '0.00'}`),
        h('span', { class: 'text-muted' }, `${row.original.frozenGift ?? '0.00'}`)
      ])
    },
    {
      accessorKey: 'totalConsume',
      header: () => $ts('module.system.member.totalConsume')
    },
    {
      accessorKey: 'inviteCode',
      header: () => $ts('module.system.member.inviteCode')
    },
    {
      accessorKey: 'inviterId',
      header: () => $ts('module.system.member.inviterId'),
      cell: ({ row }) => row.original.inviterId || '-'
    },
    useBadgeColumn<MemberProfileRow>('status', 'module.system.member.statusLabel', memberStatusConfig, 0),
    {
      accessorKey: 'createdAt',
      header: () => $ts('module.system.member.createdAt')
    },
    ...(memberPermissions.canOperate.value || canAdjust.value || canGrant.value || canChangeLevel.value ? [actionColumn] : []),
    ...(memberPermissions.canDel.value ? [selectionColumn] : [])
  ]
})

onMounted(async () => {
  await search()
})
</script>
