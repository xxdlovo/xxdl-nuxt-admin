<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <!-- 搜索表单 -->
    <div class="flex-shrink-0">
      <SysOauthConfigSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
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
              :add-permission="permissions.codes.add"
              :delete-permission="permissions.codes.del"
              class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
          >
          <template #prefix>
            <span>{{ $ts('module.system.oauthConfig.title') }}</span>
          </template>
        </TableHeaderOperation>

          <!-- 操作弹窗 -->
          <SysOauthConfigOperate
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
  title: '第三方登录配置',
  icon: 'i-lucide-settings-2'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysOauthConfigDto, SysOauthConfigQueryDTO } from '#shared/system/oauthConfig'
import SysOauthConfigSearch from './components/sys-oauth-config-search.vue'
import SysOauthConfigOperate from './components/sys-oauth-config-operate.vue'

import { businessDictCode } from '#shared/constants/business'
import { usePaginatedTable, useTableOperate, useBadgeColumn, useSelectionColumn } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const permissions = useCrudPermissions('system:oauthConfig')
const enableStatusConfig = useDictBadgeConfig(businessDictCode.enableStatus)

// 搜索参数
const searchParams = ref<SysOauthConfigQueryDTO>({})

// 表格 hook
const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysOauthConfigDto>({
  query: (params) => $trpc.sysOauthConfig.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

// 表格操作 hook
const { operateType, editingData, drawerVisible, checkedRowKeys, handleAdd, handleEdit, onDeleted, onBatchDeleted, closeVisible } = useTableOperate<SysOauthConfigDto>({
  data,
  idKey: 'id',
  refresh
})

// 选择列
const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysOauthConfigDto>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

/**
 * 处理删除
 */
const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysOauthConfig.remove.mutate(id)
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
  await $trpc.sysOauthConfig.batchDelete.mutate(checkedRowKeys.value)

  // 调用批量删除后的回调
  await onBatchDeleted()
}

// 定义列配置（包含选择列）
const columns = computed<TableColumn<SysOauthConfigDto>[]>(() => {
  const actionColumn: TableColumn<SysOauthConfigDto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      if (permissions.canEdit.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          onClick: () => handleEdit(row.original.id as string)
        }, { default: () => $ts('common.edit') }))
      }

      if (permissions.canDel.value) {
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
    ...(permissions.canDel.value ? [selectionColumn] : []),
    // 序号列
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => {
        const index = (pagination.page - 1) * pagination.pageSize + row.index + 1
        return h('span', { class: 'text-gray-500 dark:text-gray-400' }, index)
      }
    },
    // 数据列（platform 列同时展示配置的图标：图标名或 http(s) 图片地址都支持）
    {
      accessorKey: 'platform',
      header: () => $ts('module.system.oauthConfig.platform'),
      cell: ({ row }) => {
        // 与项目其它表格列一致：用 resolveComponent 取组件，
        // 避免 h() 对 <script setup> 组件的 props 做严格重载检查
        const BaseIcon = resolveComponent('BaseIcon')
        return h('div', { class: 'flex items-center gap-2' }, [
          h(BaseIcon, { name: row.original.icon ?? null }),
          h('span', {}, row.original.platform ?? '')
        ])
      }
    },
    {
      accessorKey: 'platformName',
      header: () => $ts('module.system.oauthConfig.platformName')
    },
    {
      accessorKey: 'clientId',
      header: () => $ts('module.system.oauthConfig.clientId')
    },
    {
      accessorKey: 'redirectUrl',
      header: () => $ts('module.system.oauthConfig.redirectUrl')
    },
    {
      accessorKey: 'sortOrder',
      header: () => $ts('module.system.oauthConfig.sortOrder')
    },
    useBadgeColumn<SysOauthConfigDto>(
      'status',
      'module.system.oauthConfig.status',
      enableStatusConfig.value,
      1
    ),
    {
      accessorKey: 'createdAt',
      header: () => $ts('module.system.oauthConfig.createdAt')
    },
    ...(permissions.canOperate.value ? [actionColumn] : [])
  ]
})

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
    min-width: 900px; /* 根据实际列数调整 */
  }
}
</style>
