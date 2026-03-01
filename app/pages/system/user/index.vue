<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <!-- 搜索表单 -->
    <div class="flex-shrink-0">
      <SysUserSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)"/>
    </div>

    <!-- 表格卡片 -->
    <UCard class="flex-1 min-h-0 flex flex-col overflow-hidden" :ui="{ body: 'flex flex-col h-full p-0' }">
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
              class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
          />

          <!-- 用户操作弹窗 -->
          <SysUserOperate
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
import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysUserQueryDTO } from "#shared/system/user"
import type { SysUserDto } from "#shared/system/user/common"
import SysUserSearch from './components/sys-user-search.vue'
import SysUserOperate from "./components/sys-user-operate.vue"
import { USER_GENDER_CONFIG, USER_STATUS_CONFIG } from "#shared/constants/business"
import { usePaginatedTable, useTableOperate, useBadgeColumn, useSelectionColumn } from '~/composables/useTable'
import { useToastSuccess } from '~/utils/toast'
import TableWithPagination from '~/components/table/TableWithPagination.vue'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')

// 搜索参数
const searchParams = ref<SysUserQueryDTO>({})

// 表格 hook
const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysUserDto>({
  query: (params) => $trpc.sysUser.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

// 表格操作 hook
const { operateType, editingData, drawerVisible, checkedRowKeys, handleAdd, handleEdit, onDeleted, onBatchDeleted, closeVisible } = useTableOperate<SysUserDto>({
  data,
  idKey: 'id',
  refresh
})

// 选择列
const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysUserDto>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

// 定义列配置（包含选择列）
const columns = computed<TableColumn<SysUserDto>[]>(() => {
  return [
    // 选择列
    selectionColumn,
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
      accessorKey: 'username',
      header: () => $ts('module.system.user.userName')
    },
    {
      accessorKey: 'phone',
      header: () => $ts('module.system.user.userPhone')
    },
    useBadgeColumn<SysUserDto>(
      'gender',
      'module.system.user.userGender',
      USER_GENDER_CONFIG,
      0
    ),
    {
      accessorKey: 'email',
      header: () => $ts('module.system.user.userEmail')
    },
    useBadgeColumn<SysUserDto>(
      'status',
      'module.system.user.userStatus',
      USER_STATUS_CONFIG,
      1
    ),
    {
      id: 'actions',
      header: () => $ts('common.operate'),
      cell: ({ row }) => {
        const UButton = resolveComponent('UButton')
        const Popconfirm = resolveComponent('Popconfirm')

        return h('div', { class: 'flex gap-2' }, [
          h(UButton, {
            variant: 'outline',
            color: 'primary',
            size: 'xs',
            onClick: () => handleEdit(row.original.id as string)
          }, { default: () => $ts('common.edit') }),

          h(Popconfirm, {
            onConfirm: () => handleDelete(row.original.id as string)
          }, {
            trigger: () => h(UButton, {
              variant: 'outline',
              color: 'error',
              size: 'xs'
            }, { default: () => $ts('common.delete') })
          })
        ])
      }
    }
  ]
})



/**
 * 处理删除
 */
const handleDelete = async (id: string) => {
  // 防止重复操作
  if (loading.value) return
  await $trpc.sysUser.remove.mutate(id)
  await onDeleted()
}

/**
 * 处理批量删除
 */
const handleBatchDelete = async () => {
  // 如果正在加载或没有选中项，忽略操作
  if (loading.value || checkedRowKeys.value.length === 0) {
    return
  }

  // 调用批量删除接口
  await $trpc.sysUser.batchDelete.mutate(checkedRowKeys.value)

  // 调用批量删除后的回调
  await onBatchDeleted()
}



// 初始化加载
onMounted(async () => {
  await search()
})
</script>

<style scoped>
/* 确保表格容器正确处理滚动 */
:deep(.overflow-auto) {
  -webkit-overflow-scrolling: touch; /* iOS 平滑滚动 */
}

/* 移动端优化 - 确保表格可以横向滚动 */
@media (max-width: 640px) {
  :deep(table) {
    display: table;
    width: 100%;
    min-width: 600px; /* 根据实际列数调整 */
  }
}
</style>
