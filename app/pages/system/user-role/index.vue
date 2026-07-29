<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <!-- 搜索表单 -->
    <div class="flex-shrink-0">
      <SysUserRoleSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)"/>
    </div>

    <!-- 表格卡片 -->
    <UCard class="flex-1 min-h-0 flex flex-col overflow-hidden" :ui="{body: 'flex flex-col h-full p-0 sm:p-0' }">
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
              :tableRef="tableRef?.tableRef"
              :loading="loading"
              :disabledDelete="checkedRowKeys.length === 0 || loading"
              :selectedCount="checkedRowKeys.length"
              :add-permission="userRolePermissions.codes.add"
              :delete-permission="userRolePermissions.codes.del"
              class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
          >
          <template #prefix>
            <span>{{ $ts('module.system.userRole.title') }}</span>
          </template>
        </TableHeaderOperation>

          <!-- 操作弹窗 -->
          <SysUserRoleOperate
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
  layout: 'system',
  title: '用户角色',
  icon: 'i-lucide-user-cog'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysUserRoleDto, SysUserRoleQueryDTO } from '#shared/system/userRole'
import SysUserRoleSearch from './components/sys-user-role-search.vue'
import SysUserRoleOperate from "./components/sys-user-role-operate.vue"

import { businessDictCode } from "#shared/constants/business"
import { usePaginatedTable, useTableOperate, useBadgeColumn, useSelectionColumn } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const userRolePermissions = useCrudPermissions('system:userRole')
const enableStatusConfig = useDictBadgeConfig(businessDictCode.enableStatus)

// 搜索参数
const searchParams = ref<SysUserRoleQueryDTO>({})

// 表格 hook
const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysUserRoleDto>({
  query: (params) => $trpc.sysUserRole.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

// 表格操作 hook
const { operateType, editingData, drawerVisible, checkedRowKeys, handleAdd, handleEdit, onDeleted, onBatchDeleted, closeVisible } = useTableOperate<SysUserRoleDto>({
  data,
  idKey: 'id',
  refresh
})

// 选择列
const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysUserRoleDto>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

// 定义列配置
const columns = computed<TableColumn<SysUserRoleDto>[]>(() => {
  const actionColumn: TableColumn<SysUserRoleDto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      if (userRolePermissions.canEdit.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          onClick: () => handleEdit(row.original.id as string)
        }, { default: () => $ts('common.edit') }))
      }

      if (userRolePermissions.canDel.value) {
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
    ...(userRolePermissions.canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => {
        const index = (pagination.page - 1) * pagination.pageSize + row.index + 1
        return h('span', { class: 'text-gray-500 dark:text-gray-400' }, index)
      }
    },
    {
      accessorKey: 'userId',
      header: () => $ts('module.system.userRole.userId')
    },
    {
      accessorKey: 'roleId',
      header: () => $ts('module.system.userRole.roleId')
    },
    {
      accessorKey: 'remark',
      header: () => $ts('module.system.userRole.remark')
    },
    useBadgeColumn<SysUserRoleDto>(
      'status',
      'module.system.userRole.userRoleStatus',
      enableStatusConfig.value,
      1
    ),
    ...(userRolePermissions.canOperate.value ? [actionColumn] : [])
  ]
})

/**
 * 处理删除
 */
const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysUserRole.remove.mutate(id)
  await onDeleted()
}

/**
 * 处理批量删除
 */
const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) {
    return
  }
  await $trpc.sysUserRole.batchDelete.mutate(checkedRowKeys.value)
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
