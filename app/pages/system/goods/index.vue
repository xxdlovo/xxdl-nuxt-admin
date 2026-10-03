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
      :refresh="handleOperateRefreshed"
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

/**
 * 等级价数量：契约 SysGoodsRespDTO 里没有这个字段，列表页只能按当前页的行补查后缓存。
 * 数量只是「基础价」列下方的辅助提示，取不到就整体不显示，不影响列表本身。
 */
const levelPriceCounts = ref<Record<string, number>>({})
let levelPriceCountToken = 0

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

/** 已缓存的数量为 -1 时代表查询失败，此时不显示提示 */
const levelPriceCountText = (id?: string | null) => {
  const count = id ? levelPriceCounts.value[id] : undefined

  if (typeof count !== 'number' || count < 0) {
    return ''
  }

  return $ts('module.system.goods.levelPriceCount', { count })
}

const loadLevelPriceCounts = async (rows: SysGoodsRespDTO[]) => {
  const token = ++levelPriceCountToken
  const ids = rows
    .map(row => row.id)
    .filter((id): id is string => typeof id === 'string' && id !== '' && levelPriceCounts.value[id] === undefined)

  if (ids.length === 0) {
    return
  }

  // 分批并发：一页最多 100 行，避免同一时刻打出上百个请求
  const chunkSize = 5

  for (let start = 0; start < ids.length; start += chunkSize) {
    const chunk = ids.slice(start, start + chunkSize)
    const results = await Promise.all(chunk.map(async (id) => {
      try {
        const items = await $trpc.sysGoods.levelPrices.query({ goodsId: id })
        return [id, items.length] as const
      } catch {
        // 失败不写缓存：下次列表刷新会再试一次
        return [id, -1] as const
      }
    }))

    if (token !== levelPriceCountToken) {
      return
    }

    for (const [id, count] of results) {
      if (count >= 0) {
        levelPriceCounts.value[id] = count
      }
    }
  }
}

watch(data, (rows) => {
  void loadLevelPriceCounts(rows)
})

/** 弹窗保存后会回传被改动的商品 id，用于让该行的等级价数量重新统计 */
const handleOperateRefreshed = async (changedGoodsId?: string) => {
  if (changedGoodsId) {
    delete levelPriceCounts.value[changedGoodsId]
  }

  await refresh()
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
        const countText = levelPriceCountText(row.original.id)

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
