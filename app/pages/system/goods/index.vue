<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysGoodsSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
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
            :add-permission="goodsPermissions.codes.add"
            :delete-permission="goodsPermissions.codes.del"
            class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
            @add="handleAdd"
            @delete="handleBatchDelete"
            @refresh="refresh"
          >
            <template #prefix>
              <span>{{ $ts('module.system.goods.title') }}</span>
            </template>
          </TableHeaderOperation>
        </template>
      </TableWithPagination>
    </UCard>

    <!-- 弹窗放在 TableHeaderOperation 之外：填了默认插槽会顶掉组件内置的新增/批量删除按钮 -->
    <SysGoodsOperate
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
  title: '商品管理',
  icon: 'i-lucide-package'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysGoodsQueryDTO, SysGoodsRespDTO } from '#shared/system/goods'
import { goodsStatusConfig, goodsTypeRecord } from '#shared/constants/business'
import { badgeColorClasses } from '~/composables/badgeColorClasses'
import { usePaginatedTable, useTableOperate, useBadgeColumn, useSelectionColumn } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'
import SysGoodsSearch from './components/sys-goods-search.vue'
import SysGoodsOperate from './components/sys-goods-operate.vue'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const goodsPermissions = useCrudPermissions('system:goods')
const searchParams = ref<SysGoodsQueryDTO>({})

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysGoodsRespDTO>({
  query: params => $trpc.sysGoods.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

const { operateType, editingData, drawerVisible, checkedRowKeys, handleAdd, handleEdit, onDeleted, onBatchDeleted, closeVisible } = useTableOperate<SysGoodsRespDTO>({
  data,
  idKey: 'id',
  refresh
})

const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysGoodsRespDTO>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

/** 类型文案走本文常量映射，不依赖可被后台改坏的字典 */
const typeLabel = (type?: string | null) => {
  const key = type ? goodsTypeRecord[type] : undefined
  return key ? $ts(key) : (type || '-')
}

const priceText = (price?: string | number | null) => {
  const value = Number(price ?? 0)
  return `¥${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`
}

/**
 * 等级价数量：由列表接口 `sysGoods.page` 直接带出（`levelPriceCount`），
 * 列表页不再逐行调用 `sysGoods.levelPrices` 补查，刷新列表即刷新数量。
 *
 * 数量只是「基础价」列下方的辅助提示：列表未返回该字段（或值异常）时不显示，
 * 返回 0 时照旧显示「0 个等级价」，都不影响列表本身。
 */
const levelPriceCountText = (row: SysGoodsRespDTO) => {
  const count = row.levelPriceCount

  if (typeof count !== 'number' || count < 0) {
    return ''
  }

  return $ts('module.system.goods.levelPriceCount', { count })
}

const columns = computed<TableColumn<SysGoodsRespDTO>[]>(() => {
  const actionColumn: TableColumn<SysGoodsRespDTO> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      if (goodsPermissions.canEdit.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          onClick: () => handleEdit(row.original.id as string)
        }, { default: () => $ts('common.edit') }))
      }

      if (goodsPermissions.canDel.value) {
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
    ...(goodsPermissions.canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => h('span', { class: 'text-muted' }, (pagination.page - 1) * pagination.pageSize + row.index + 1)
    },
    {
      id: 'cover',
      header: () => $ts('module.system.goods.cover'),
      cell: ({ row }) => h('div', {
        class: 'w-10 h-10 rounded overflow-hidden bg-elevated flex items-center justify-center flex-shrink-0'
      }, [
        row.original.cover
          ? h('img', { src: row.original.cover, class: 'w-full h-full object-cover' })
          : h(resolveComponent('UIcon'), { name: 'i-lucide-image-off', class: 'text-muted' })
      ])
    },
    {
      accessorKey: 'name',
      header: () => $ts('module.system.goods.name'),
      cell: ({ row }) => h('div', { class: 'min-w-0' }, [
        h('div', { class: 'font-medium truncate max-w-60' }, row.original.name || '-'),
        row.original.subtitle
          ? h('div', { class: 'text-xs text-muted truncate max-w-60' }, row.original.subtitle)
          : null
      ])
    },
    {
      accessorKey: 'type',
      header: () => $ts('module.system.goods.typeLabel'),
      cell: ({ row }) => {
        // 服务类商品需要人工交付，用醒目徽标与虚拟物品区分开
        if (row.original.type === 'service') {
          return h('span', {
            class: `inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${badgeColorClasses.warning}`
          }, [
            h(resolveComponent('UIcon'), { name: 'i-lucide-headset', class: 'size-3' }),
            typeLabel(row.original.type)
          ])
        }

        return h('span', { class: 'text-muted' }, typeLabel(row.original.type))
      }
    },
    {
      id: 'price',
      header: () => $ts('module.system.goods.price'),
      cell: ({ row }) => {
        const countText = levelPriceCountText(row.original)

        return h('div', {}, [
          h('div', { class: 'font-medium' }, priceText(row.original.price)),
          countText ? h('div', { class: 'text-xs text-muted' }, countText) : null
        ])
      }
    },
    {
      accessorKey: 'stock',
      header: () => $ts('module.system.goods.stock'),
      cell: ({ row }) => row.original.unlimitedStock === 1
        ? $ts('module.system.goods.unlimitedStock')
        : String(row.original.stock ?? 0)
    },
    {
      accessorKey: 'salesCount',
      header: () => $ts('module.system.goods.salesCount'),
      cell: ({ row }) => String(row.original.salesCount ?? 0)
    },
    {
      accessorKey: 'sortOrder',
      header: () => $ts('module.system.goods.sortOrder'),
      cell: ({ row }) => String(row.original.sortOrder ?? 0)
    },
    useBadgeColumn<SysGoodsRespDTO>('status', 'module.system.goods.statusLabel', goodsStatusConfig, 1),
    ...(goodsPermissions.canOperate.value ? [actionColumn] : [])
  ]
})

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysGoods.remove.mutate(id)
  await onDeleted()
}

const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) {
    return
  }
  await $trpc.sysGoods.batchDelete.mutate(checkedRowKeys.value)
  await onBatchDeleted()
}

onMounted(async () => {
  await search()
})
</script>
