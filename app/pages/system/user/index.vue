<template>
  <div class="flex flex-col gap-4">
    <!-- 搜索表单 -->
    <SysUserSearch @reset="handleReset" @search="handleSearch"/>

    <!-- 表格卡片 -->
    <UCard class="flex flex-col h-[calc(100vh-200px)]" :ui="{ body: 'flex flex-col h-full p-0' }">
      <!-- 表头操作栏 -->
      <TableHeaderOperation
          v-if="table"
          @add="openAdd"
          @delete="handleBatchDelete"
          @refresh="refresh"
          :tableRef="table"
          :loading="loading"
          :disabledDelete="selectedRows.length === 0 || loading || batchDeleteLoading"
          :batchDeleteLoading="batchDeleteLoading"
          :selectedCount="selectedRows.length"
          class="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
      />

      <!-- 表格容器 -->
      <div class="flex-1 overflow-auto px-4 min-h-0 relative">
        <!-- Loading 遮罩 -->
        <div
            v-if="loading"
            class="absolute inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-10"
        >
            <div class="flex flex-col items-center gap-3">
                <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-primary animate-spin" />
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ $ts('common.loading') }}</span>
            </div>
        </div>

        <UTable
            ref="table"
            :data="data"
            :columns="columns"
            :loading="loading"
            sticky
            class="min-w-full h-full"
        />
      </div>

      <!-- 分页 -->
      <div class="flex-shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div class="flex items-center justify-end gap-2">
          <!-- 总数 -->
          <div class="hidden sm:block text-sm text-gray-700 dark:text-gray-300">
            共 {{ pagination.total }} 条
          </div>

          <!-- 每页条数选择 -->
          <USelect
              v-model="pagination.pageSize"
              :items="pageSizeOptions"
              :disabled="loading"
              class="w-16 sm:w-20"
              @change="() => changePageSize(pagination.pageSize)"
          />

          <!-- 分页器 -->
          <UPagination
              v-model:page="pagination.page"
              :items-per-page="pagination.pageSize"
              :total="pagination.total"
              :max="5"
              :disabled="loading"
              show-first
              show-last
              @click="() => changePage(pagination.page)"
          />
        </div>
      </div>
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
import { usePaginatedTable, useTableOperate, useBadgeColumn } from '~/composables/useTable'
import { useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const table = useTemplateRef('table')
const overlay = useOverlay()
const modal = overlay.create(SysUserOperate)

// 搜索参数
const searchParams = ref<SysUserQueryDTO>({})

// 选中的行（多选）
const selectedRows = ref<SysUserDto[]>([])

// 批量删除loading
const batchDeleteLoading = ref(false)

// 表格 hook
const {
  data,
  loading,
  columns,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  changePage,
  changePageSize
} = usePaginatedTable<SysUserDto>({
  query: (params) => $trpc.sysUser.page.query(params),
  pageSizeOptions: [10, 20, 50, 100],
  columns: () => [
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => {
        // 计算序号：考虑分页
        const index = (pagination.page - 1) * pagination.pageSize + row.index + 1
        return h('span', { class: 'text-gray-500 dark:text-gray-400' }, index)
      }
    },
    {
      accessorKey: 'username',
      header: () => $ts('module.system.user.userName')
    },
    {
      accessorKey: 'phone',
      header: () => $ts('module.system.user.userPhone')
    },
    useBadgeColumn(
      'gender',
      'module.system.user.userGender',
      USER_GENDER_CONFIG,
      0
    ),
    {
      accessorKey: 'email',
      header: () => $ts('module.system.user.userEmail')
    },
    useBadgeColumn(
      'status',
      'module.system.user.userStatus',
      USER_STATUS_CONFIG,
      1
    ),
    {
      accessorKey: 'actions',
      header: () => $ts('common.operate'),
      cell: ({ row }) => {
        const UButton = resolveComponent('UButton')
        const Popconfirm = resolveComponent('Popconfirm')

        return h('div', { class: 'flex gap-2' }, [
          h(UButton, {
            variant: 'outline',
            color: 'primary',
            size: 'xs',
            onClick: () => openEdit(row.original.id as string)
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

// 表格操作 hook
const tableOperate = useTableOperate<SysUserDto>({
  data,
  idKey: 'id',
  refresh
})

/**
 * 打开新增弹窗
 */
const openAdd = () => {
  const { operateType, editingData } = tableOperate.handleAdd()
  modal.open({
    operateType: operateType,
    data: editingData,
    close: () => modal.close(),
    refresh
  })
}

/**
 * 打开编辑弹窗
 */
const openEdit = (id: string) => {
  const { operateType, editingData } = tableOperate.handleEdit(id)
  modal.open({
    operateType: operateType,
    data: editingData,
    close: () => modal.close(),
    refresh
  })
}

/**
 * 处理删除
 */
const handleDelete = async (id: string) => {
  // 防止重复操作
  if (loading.value) return

  await tableOperate.handleDelete(id, async (id) => {
    // 删除操作会自动显示 loading 状态
    await $trpc.sysUser.remove.mutate(id)
  })
}

/**
 * 处理批量删除
 */
const handleBatchDelete = async () => {
  // 如果正在加载或没有选中项，忽略操作
  if (loading.value || batchDeleteLoading.value || selectedRows.value.length === 0) {
    return
  }

  batchDeleteLoading.value = true
  try {
    // 提取所有选中的 ID
    const ids = selectedRows.value.map(row => row.id as string)

    // 调用批量删除接口
    await $trpc.sysUser.batchDelete.mutate(ids)

    // 清空选中项
    selectedRows.value = []

    // 显示成功提示
    useToastSuccess($ts('common.deleteSuccess'))

    // 刷新列表
    await refresh()
  } finally {
    batchDeleteLoading.value = false
  }
}

/**
 * 处理搜索
 */
const handleSearch = async (params: SysUserQueryDTO) => {
  // 如果正在加载，忽略请求
  if (loading.value) return

  searchParams.value = { ...searchParams.value, ...params }
  pagination.page = 1
  await search(searchParams.value)
}

/**
 * 处理重置
 */
const handleReset = async () => {
  // 如果正在加载，忽略请求
  if (loading.value) return

  searchParams.value = {}
  pagination.page = 1
  await search(searchParams.value)
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
