<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <!-- 搜索表单 -->
    <div class="flex-shrink-0">
      <SysUserSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)"/>
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
              :add-permission="userPermissions.codes.add"
              :delete-permission="userPermissions.codes.del"
              class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
          >
          <template #prefix>
            <span>{{ $ts('module.system.user.title') }}</span>
          </template>
        </TableHeaderOperation>

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

    <UModal
      v-model:open="resetPasswordVisible"
      :title="$ts('module.system.user.resetPassword')"
      :dismissible="false"
      :ui="{ content: 'max-w-md' }"
    >
      <template #body>
        <UForm
          :validate="validateResetPassword"
          :state="resetPasswordState"
          class="space-y-4"
          @submit="handleResetPassword"
        >
          <UFormField
            name="password"
            required
            :label="$ts('module.system.user.newPassword')"
            orientation="horizontal"
            :ui="{ root: 'flex items-center', label: 'w-20 text-right pr-2 flex-shrink-0', container: 'flex-1' }"
          >
            <UBaseInput v-model="resetPasswordState.password" :placeholder="$ts('module.system.user.form.newPassword')" trailing="password" />
          </UFormField>
          <UFormField
            name="confirmPassword"
            required
            :label="$ts('module.system.user.confirmPassword')"
            orientation="horizontal"
            :ui="{ root: 'flex items-center', label: 'w-20 text-right pr-2 flex-shrink-0', container: 'flex-1' }"
          >
            <UBaseInput v-model="resetPasswordState.confirmPassword" :placeholder="$ts('module.system.user.form.confirmPassword')" trailing="password" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" @click="resetPasswordVisible = false" />
            <UButton :label="$ts('common.confirm')" color="primary" type="submit" />
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '用户管理',
  icon: 'i-lucide-users'
})

import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import { SysUserResetPasswordSchema, type SysUserQueryDTO, type SysUserResetPasswordDTO } from "#shared/system/user"
import type { SysUserDto } from "#shared/system/user/common"
import SysUserSearch from './components/sys-user-search.vue'
import SysUserOperate from "./components/sys-user-operate.vue"
import { ENABLE_STATUS_CONFIG, USER_GENDER_CONFIG } from "#shared/constants/business"
import { usePaginatedTable, useTableOperate, useBadgeColumn, useSelectionColumn } from '~/composables/useTable'
import { useToastSuccess } from '~/utils/toast'
import TableWithPagination from '~/components/table/TableWithPagination.vue'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const userPermissions = useCrudPermissions('system:user')
const resetPasswordVisible = ref(false)
const resetPasswordState = ref<SysUserResetPasswordDTO>({
  id: '',
  password: '',
  confirmPassword: ''
})

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

const { validate: validateResetPassword } = useZodValidation({
  schema: () => SysUserResetPasswordSchema as any
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
  const actionColumn: TableColumn<SysUserDto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      if (userPermissions.canEdit.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          onClick: () => handleEdit(row.original.id as string)
          }, { default: () => $ts('common.edit') }))
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'neutral',
          size: 'xs',
          icon: 'i-lucide-key-round',
          onClick: () => openResetPassword(row.original)
        }, { default: () => $ts('module.system.user.resetPassword') }))
      }

      if (userPermissions.canDel.value) {
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
    ...(userPermissions.canDel.value ? [selectionColumn] : []),
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
      ENABLE_STATUS_CONFIG,
      1
    ),
    ...(userPermissions.canOperate.value ? [actionColumn] : [])
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

const openResetPassword = (row: SysUserDto) => {
  resetPasswordState.value = {
    id: row.id || '',
    password: '',
    confirmPassword: ''
  }
  resetPasswordVisible.value = true
}

const handleResetPassword = async (event: FormSubmitEvent<SysUserResetPasswordDTO>) => {
  if (!event.data.id) {
    return
  }

  await $trpc.sysUser.resetPassword.mutate(event.data)
  useToastSuccess($ts('module.system.user.resetPasswordSuccess'))
  resetPasswordVisible.value = false
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
