<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <!-- 搜索表单 -->
    <div class="flex-shrink-0">
      <SysMenuSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)"/>
    </div>

    <!-- 表格卡片 -->
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
              @add="handleAdd"
              @delete="handleBatchDelete"
              @refresh="refresh"
              :tableRef="tableRef.tableRef"
              :loading="loading"
              :disabledDelete="checkedRowKeys.length === 0 || loading"
              :selectedCount="checkedRowKeys.length"
              :add-permission="menuPermissions.codes.add"
              :delete-permission="menuPermissions.codes.del"
              class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
          >
          <template #prefix>
            <span>{{ $ts('module.system.menu.title') }}</span>
          </template>
        </TableHeaderOperation>

          <!-- 操作弹窗 -->
          <SysMenuOperate
              v-model:visible="drawerVisible"
              :operate-type="operateType"
              :data="editingData ?? undefined"
              :close="closeVisible"
              :refresh="refresh"
          />
        </template>
      </TableWithPagination>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysMenuDto, SysMenuQueryDTO } from "#shared/system/menu"
import SysMenuSearch from './components/sys-menu-search.vue'
import SysMenuOperate from "./components/sys-menu-operate.vue"
import { USER_STATUS_CONFIG } from "#shared/constants/business"
import { usePaginatedTable, useTableOperate, useBadgeColumn, useSelectionColumn } from '~/composables/useTable'
import { useToastSuccess } from '~/utils/toast'
import TableWithPagination from '~/components/table/TableWithPagination.vue'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const menuPermissions = useCrudPermissions('system:menu')

// 搜索参数
const searchParams = ref<SysMenuQueryDTO>({})

// 表格 hook
const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysMenuDto>({
  query: (params) => $trpc.sysMenu.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

// 表格操作 hook
const { operateType, editingData, drawerVisible, checkedRowKeys, handleAdd, handleEdit, onDeleted, onBatchDeleted, closeVisible } = useTableOperate<SysMenuDto>({
  data,
  idKey: 'id',
  refresh
})

// 选择列
const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysMenuDto>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

// 定义列配置（包含选择列）
const columns = computed<TableColumn<SysMenuDto>[]>(() => {
  const actionColumn: TableColumn<SysMenuDto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      if (menuPermissions.canEdit.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          onClick: () => handleEdit(row.original.id as string)
        }, { default: () => $ts('common.edit') }))
      }

      if (menuPermissions.canDel.value) {
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
    // 选择列
    ...(menuPermissions.canDel.value ? [selectionColumn] : []),
    // 序号列
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => {
        const index = (pagination.page - 1) * pagination.pageSize + row.index + 1
        return h('span', { class: 'text-gray-500 dark:text-gray-400' }, index)
      }
    },
    // 数据列
    {
      accessorKey: 'name',
      header: () => $ts('module.system.menu.menuName')
    },
    {
      accessorKey: 'code',
      header: () => $ts('module.system.menu.routeName')
    },
    useBadgeColumn<SysMenuDto>(
      'type',
      'module.system.menu.menuType',
      {
        '1': { i18nKey: 'module.system.menu.type.directory', color: 'primary' },
        '2': { i18nKey: 'module.system.menu.type.menu', color: 'success' }
      },
      1
    ),
    {
      accessorKey: 'path',
      header: () => $ts('module.system.menu.routePath')
    },
    {
      accessorKey: 'icon',
      header: () => $ts('module.system.menu.icon')
    },
    {
      accessorKey: 'sortOrder',
      header: () => $ts('module.system.menu.order')
    },
    useBadgeColumn<SysMenuDto>(
      'status',
      'module.system.menu.menuStatus',
      USER_STATUS_CONFIG,
      1
    ),
    ...(menuPermissions.canOperate.value ? [actionColumn] : [])
  ]
})

/**
 * 处理删除
 */
const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysMenu.remove.mutate(id)
  await onDeleted()
}

/**
 * 处理批量删除
 */
const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) {
    return
  }
  await $trpc.sysMenu.batchDelete.mutate(checkedRowKeys.value)
  await onBatchDeleted()
}

// 初始化加载
onMounted(async () => {
  await search()
})
</script>

<style scoped>
:deep(.overflow-auto) {
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 640px) {
  :deep(table) {
    display: table;
    width: 100%;
    min-width: 600px;
  }
}
</style>
