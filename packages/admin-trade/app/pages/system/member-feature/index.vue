<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysMemberFeatureSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
    </div>

    <UCard class="flex-1 min-h-0 flex flex-col overflow-hidden" :ui="{ body: 'flex flex-col h-full p-0 sm:p-0' }">
      <TableWithPagination
        ref="table"
        :data="data"
        :columns="columns"
        :loading="loading"
        :pagination="pagination"
        :page-size-options="pageSizeOptions"
        compact-mobile
        :mobile-row-actions="rowActions"
      >
        <template #header>
          <TableHeaderOperation
            v-if="tableRef?.tableRef"
            :table-ref="tableRef.tableRef"
            :loading="loading"
            :disabled-delete="checkedRowKeys.length === 0 || loading"
            :selected-count="checkedRowKeys.length"
            :add-permission="featurePermissions.codes.add"
            :delete-permission="featurePermissions.codes.del"
            compact-mobile
            class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
            @add="handleAdd"
            @delete="handleBatchDelete"
            @refresh="refresh"
          >
            <template #prefix>
              <span class="hidden md:inline">{{ $ts('module.system.memberFeature.title') }}</span>
            </template>
          </TableHeaderOperation>
        </template>
      </TableWithPagination>
    </UCard>

    <!-- 弹窗放在 TableHeaderOperation 之外：填了默认插槽会顶掉组件内置的新增/批量删除按钮 -->
    <SysMemberFeatureOperate
      v-model:visible="drawerVisible"
      :operate-type="operateType"
      :data="editingData ?? undefined"
      :close="closeVisible"
      :refresh="refresh"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '功能目录',
  icon: 'i-lucide-toy-brick'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { BadgeConfig } from '#admin/shared/types/nuxtui'
import { usePaginatedTable, useTableOperate, useBadgeColumn, useSelectionColumn } from '#admin/app/composables/useTable'
import type { MobileRowAction } from '#admin/app/composables/useTable'
import TableWithPagination from '#admin/app/components/table/TableWithPagination.vue'
import CopyValueBadge from '#admin/app/components/base/CopyValueBadge.vue'
import type { MemberFeatureQuery, MemberFeatureRow } from './components/types'
import SysMemberFeatureSearch from './components/sys-member-feature-search.vue'
import SysMemberFeatureOperate from './components/sys-member-feature-operate.vue'

/**
 * 功能类型徽标：switch 开关 / quota 配额。
 * 与后端约定一致（kind = switch | quota），用本文常量映射，不进字典表。
 */
const memberFeatureKindConfig: Readonly<Record<string, BadgeConfig>> = {
  switch: { i18nKey: 'module.system.memberFeature.kindSwitch', color: 'primary' },
  quota: { i18nKey: 'module.system.memberFeature.kindQuota', color: 'info' }
}

/** 状态徽标：1 启用 / 0 停用 */
const memberFeatureStatusConfig: Readonly<Record<string, BadgeConfig>> = {
  '1': { i18nKey: 'module.system.memberFeature.statusEnabled', color: 'success' },
  '0': { i18nKey: 'module.system.memberFeature.statusDisabled', color: 'neutral' }
}

/** 管理员绕过：1 是 / 0 否（语义是「是不是」，复用 common.yesOrNo.*） */
const memberFeatureYesNoConfig: Readonly<Record<string, BadgeConfig>> = {
  '1': { i18nKey: 'common.yesOrNo.yes', color: 'success' },
  '0': { i18nKey: 'common.yesOrNo.no', color: 'neutral' }
}

/**
 * 用户可见：1 可见 / 0 仅后端。
 * `userShow = 0` 表示该功能只做后端强制，用户侧连名称与额度都看不到（被拒只提示「当前操作不可用」）。
 */
const memberFeatureUserShowConfig: Readonly<Record<string, BadgeConfig>> = {
  '1': { i18nKey: 'module.system.memberFeature.userShowVisible', color: 'success' },
  '0': { i18nKey: 'module.system.memberFeature.onlyBackend', color: 'warning' }
}

const $trpc = useTradeTrpc()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const featurePermissions = useCrudPermissions('system:memberFeature')
const searchParams = ref<MemberFeatureQuery>({})

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<MemberFeatureRow>({
  query: params => $trpc.sysMemberFeature.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

const { operateType, editingData, drawerVisible, checkedRowKeys, handleAdd, handleEdit, onDeleted, onBatchDeleted, closeVisible } = useTableOperate<MemberFeatureRow>({
  data,
  idKey: 'id',
  refresh
})

const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<MemberFeatureRow>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

const columns = computed<TableColumn<MemberFeatureRow>[]>(() => {
  const actionColumn: TableColumn<MemberFeatureRow> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      if (featurePermissions.canEdit.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          onClick: () => handleEdit(row.original.id as string)
        }, { default: () => $ts('common.edit') }))
      }

      if (featurePermissions.canDel.value) {
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
    ...(featurePermissions.canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => h('span', { class: 'text-muted' }, (pagination.page - 1) * pagination.pageSize + row.index + 1)
    },
    {
      accessorKey: 'featureKey',
      header: () => $ts('module.system.memberFeature.featureKey'),
      // 功能键是代码契约（v-feature / can() 都用它），点一下即可复制
      cell: ({ row }) => row.original.featureKey
        ? h(CopyValueBadge, {
            label: '',
            value: String(row.original.featureKey),
            color: 'primary',
            icon: 'i-lucide-key-round'
          })
        : h('span', { class: 'text-muted' }, '-')
    },
    {
      accessorKey: 'name',
      header: () => $ts('module.system.memberFeature.name'),
      cell: ({ row }) => row.original.name || '-'
    },
    useBadgeColumn<MemberFeatureRow>('kind', 'module.system.memberFeature.kind', memberFeatureKindConfig, 0),
    {
      accessorKey: 'unit',
      header: () => $ts('module.system.memberFeature.unit'),
      cell: ({ row }) => row.original.unit || '-'
    },
    {
      accessorKey: 'groupName',
      header: () => $ts('module.system.memberFeature.groupName'),
      cell: ({ row }) => row.original.groupName || $ts('module.system.memberFeature.groupDefault')
    },
    {
      accessorKey: 'defaultValue',
      header: () => $ts('module.system.memberFeature.defaultValue'),
      // 开关型显示 开/关；配额型 -1 显示「不限」，其余显示数字
      cell: ({ row }) => {
        const value = Number(row.original.defaultValue ?? 0)

        if (row.original.kind === 'switch') {
          return $ts(value === 1 ? 'module.system.memberFeature.switchOn' : 'module.system.memberFeature.switchOff')
        }

        return value === -1
          ? $ts('module.system.memberFeature.unlimited')
          : String(value)
      }
    },
    {
      accessorKey: 'resolverKey',
      header: () => $ts('module.system.memberFeature.resolverKey'),
      cell: ({ row }) => row.original.resolverKey
        ? h('span', { class: 'font-mono text-xs' }, String(row.original.resolverKey))
        : h('span', { class: 'text-muted' }, '-')
    },
    useBadgeColumn<MemberFeatureRow>('adminBypass', 'module.system.memberFeature.adminBypass', memberFeatureYesNoConfig, 0),
    useBadgeColumn<MemberFeatureRow>('userShow', 'module.system.memberFeature.userShow', memberFeatureUserShowConfig, 1),
    useBadgeColumn<MemberFeatureRow>('status', 'module.system.memberFeature.status', memberFeatureStatusConfig, 1),
    ...(featurePermissions.canOperate.value ? [actionColumn] : [])
  ]
})

/** 移动端行操作：点击「⋯」在按钮下方展示 */
const rowActions = (row: MemberFeatureRow): MobileRowAction[] => {
  const items: MobileRowAction[] = []

  if (featurePermissions.canEdit.value) {
    items.push({
      label: $ts('common.edit'),
      icon: 'i-lucide-pencil',
      color: 'primary',
      onSelect: () => handleEdit(row.id as string)
    })
  }

  if (featurePermissions.canDel.value) {
    items.push({
      label: $ts('common.delete'),
      icon: 'i-lucide-trash-2',
      color: 'error',
      confirm: $ts('common.confirmDelete', { count: 1 }),
      onSelect: () => handleDelete(row.id as string)
    })
  }

  return items
}

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysMemberFeature.remove.mutate(id)
  await onDeleted()
}

const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) {
    return
  }
  await $trpc.sysMemberFeature.batchDelete.mutate(checkedRowKeys.value)
  await onBatchDeleted()
}

onMounted(async () => {
  await search()
})
</script>
