<script setup lang="ts">
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import { SysUserResetPasswordSchema, type SysUserQueryDTO, type SysUserResetPasswordDTO } from '#admin/shared/system/user'
import type { SysUserDto } from '#admin/shared/system/user/common'
import SysUserSearch from './components/sys-user-search.vue'
import SysUserOperate from './components/sys-user-operate.vue'
import DeptSideTree, { type DeptTreeItem } from '../dept/components/DeptSideTree.vue'
import { businessDictCode } from '#admin/shared/constants/business'
import { usePaginatedTable, useTableOperate, useBadgeColumn, useSelectionColumn, minWidthColumn, stableColumn, stickyRightColumn, tableColumnWidth, withColumnWidth } from '#admin/app/composables/useTable'
import type { MobileRowAction } from '#admin/app/composables/useTable'
import { useToastSuccess } from '#admin/app/utils/toast'
import {
  downloadExcel,
  downloadExcelTemplate,
  importExcel,
  type ExcelImportResult
} from '#admin/app/utils/excel'
import TableWithPagination from '#admin/app/components/table/TableWithPagination.vue'
const { hasPermission } = useRbacProfile()
type SysUserTableRow = SysUserDto & {
  deptName?: string | null
  deptCode?: string | null
}

definePageMeta({
  layout: 'system',
  title: '用户管理',
  icon: 'i-lucide-users'
})

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const dictStore = useDictStore()
const tableRef = useTemplateRef('table')
const userPermissions = useCrudPermissions('system:user')
const enableStatusConfig = useDictBadgeConfig(businessDictCode.enableStatus)
const userGenderConfig = useDictBadgeConfig(businessDictCode.userGender)

const deptKeyword = ref('')
const selectedDeptId = ref<string | null>(null)
const selectedDeptLabel = ref('全部部门')
const resetPasswordVisible = ref(false)
const importVisible = ref(false)
const importing = ref(false)
const importFile = ref<File | null>(null)
const importResult = ref<ExcelImportResult | null>(null)
const resetPasswordState = ref<SysUserResetPasswordDTO>({
  id: '',
  password: '',
  confirmPassword: ''
})

const searchParams = ref<SysUserQueryDTO>({})

const deleteConfirmVisible = ref(false)
const pendingDeleteRow = ref<SysUserTableRow | null>(null)
const deletingUser = ref(false)

const currentDeptId = computed(() => selectedDeptId.value || undefined)

/** 锁定判断以服务端返回的 lockedUntil 为准；过期时间已过则视为未锁定。 */
const isUserLocked = (row: SysUserTableRow) => {
  if (!row.lockedUntil) {
    return false
  }

  const time = new Date(row.lockedUntil).getTime()
  return Number.isFinite(time) && time > Date.now()
}

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysUserTableRow>({
  query: params => $trpc.sysUser.page.query({
    ...searchParams.value,
    ...params,
    deptId: currentDeptId.value
  }),
  pageSizeOptions: [10, 20, 50, 100]
})

const { validate: validateResetPassword } = useZodValidation({
  schema: () => SysUserResetPasswordSchema as any
})

const { operateType, editingData, drawerVisible, checkedRowKeys, handleAdd, handleEdit, onDeleted, onBatchDeleted, closeVisible } = useTableOperate<SysUserTableRow>({
  data,
  idKey: 'id',
  refresh
})

const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysUserTableRow>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

const columns = computed<TableColumn<SysUserTableRow>[]>(() => {
  /** 移动端只保留图标，桌面端显示文字 */
  const actionText = (text: string) => h('span', { class: 'hidden md:inline' }, text)

  const actionColumn: TableColumn<SysUserTableRow> = {
    id: 'actions',
    ...stickyRightColumn(240),
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
          icon: 'i-lucide-pencil',
          class: 'px-2',
          onClick: () => handleEdit(row.original.id as string)
        }, { default: () => actionText($ts('common.edit')) }))
      }
      if (isUserLocked(row.original) && hasPermission('system:user:unlock')) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'warning',
          size: 'xs',
          icon: 'i-lucide-lock-open',
          class: 'px-2',
          onClick: () => unlockUser(row.original)
        }, { default: () => actionText($ts('module.system.user.unlock')) }))
      }
      if (hasPermission('system:user:reset')) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'neutral',
          size: 'xs',
          icon: 'i-lucide-key-round',
          class: 'px-2',
          onClick: () => openResetPassword(row.original)
        }, { default: () => actionText($ts('module.system.user.resetPassword')) }))
      }

      if (userPermissions.canDel.value) {
        actions.push(h(Popconfirm, {
          onConfirm: () => handleDelete(row.original.id as string)
        }, {
          trigger: () => h(UButton, {
            variant: 'outline',
            color: 'error',
            size: 'xs',
            icon: 'i-lucide-trash-2',
            class: 'px-2'
          }, { default: () => actionText($ts('common.delete')) })
        }))
      }

      return h('div', { class: 'flex flex-wrap gap-2' }, actions)
    }
  }

  return [
    ...(userPermissions.canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      ...stableColumn(tableColumnWidth.index),
      header: () => $ts('common.index'),
      cell: ({ row }) => {
        const index = (pagination.page - 1) * pagination.pageSize + row.index + 1
        return h('span', { class: 'text-gray-500 dark:text-gray-400' }, index)
      }
    },
    {
      accessorKey: 'username',
      ...minWidthColumn(180),
      header: () => $ts('module.system.user.userName'),
      cell: ({ row }) => h('span', { class: 'block truncate', title: row.original.username ?? '' }, row.original.username || '-')
    },
    {
      accessorKey: 'phone',
      ...minWidthColumn(128),
      header: () => $ts('module.system.user.userPhone'),
      cell: ({ row }) => h('span', { class: 'block truncate', title: row.original.phone ?? '' }, row.original.phone || '-')
    },
    {
      accessorKey: 'deptName',
      ...minWidthColumn(140),
      header: () => $ts('module.system.user.userDept'),
      cell: ({ row }) => h('span', { class: 'block truncate text-muted', title: row.original.deptName || row.original.deptCode || '' }, row.original.deptName || row.original.deptCode || '-')
    },
    {
      accessorKey: 'postNames',
      ...minWidthColumn(140),
      header: () => $ts('module.system.user.userPost'),
      cell: ({ row }) => h('span', { class: 'block truncate text-muted', title: row.original.postNames ?? '' }, row.original.postNames || '-')
    },
    withColumnWidth(useBadgeColumn<SysUserTableRow>(
      'gender',
      'module.system.user.userGender',
      userGenderConfig.value,
      0
    ), stableColumn(tableColumnWidth.badge)),
    {
      accessorKey: 'email',
      ...minWidthColumn(220),
      header: () => $ts('module.system.user.userEmail'),
      cell: ({ row }) => h('span', { class: 'block truncate', title: row.original.email ?? '' }, row.original.email || '-')
    },
    withColumnWidth(useBadgeColumn<SysUserTableRow>(
      'status',
      'module.system.user.userStatus',
      enableStatusConfig.value,
      1
    ), stableColumn(tableColumnWidth.status)),
    {
      id: 'locked',
      ...stableColumn(tableColumnWidth.status),
      header: () => $ts('module.system.user.locked'),
      cell: ({ row }) => isUserLocked(row.original)
        ? h(resolveComponent('UBadge'), {
            color: 'error',
            variant: 'subtle',
            size: 'sm'
          }, { default: () => $ts('module.system.user.locked') })
        : h('span', { class: 'text-muted' }, '-')
    },
    ...(userPermissions.canOperate.value ? [actionColumn] : [])
  ]
})

const selectDept = async (item: DeptTreeItem) => {
  selectedDeptLabel.value = item.label
  checkedRowKeys.value = []
  await getDataByPage(1)
}

const handleDeptSearch = (keyword: string) => {
  deptKeyword.value = keyword
}

const handleUserSearch = async (params: SysUserQueryDTO) => {
  searchParams.value = params
  checkedRowKeys.value = []
  await getDataByPage(1)
}

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysUser.remove.mutate(id)
  await onDeleted()
}

/** 移动端行操作：点击行后弹出底部操作面板 */
const rowActions = (row: SysUserTableRow): MobileRowAction[] => {
  const items: MobileRowAction[] = []

  if (userPermissions.canEdit.value) {
    items.push({
      label: $ts('common.edit'),
      icon: 'i-lucide-pencil',
      color: 'primary',
      onSelect: () => handleEdit(row.id as string)
    })
  }

  if (isUserLocked(row) && hasPermission('system:user:unlock')) {
    items.push({
      label: $ts('module.system.user.unlock'),
      icon: 'i-lucide-lock-open',
      color: 'warning',
      onSelect: () => unlockUser(row)
    })
  }

  if (hasPermission('system:user:reset')) {
    items.push({
      label: $ts('module.system.user.resetPassword'),
      icon: 'i-lucide-key-round',
      onSelect: () => openResetPassword(row)
    })
  }

  if (userPermissions.canDel.value) {
    items.push({
      label: $ts('common.delete'),
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => openDeleteConfirm(row)
    })
  }

  return items
}

function openDeleteConfirm(row: SysUserTableRow) {
  pendingDeleteRow.value = row
  deleteConfirmVisible.value = true
}

async function confirmDeleteUser() {
  const id = pendingDeleteRow.value?.id
  if (!id || deletingUser.value) {
    return
  }

  deletingUser.value = true
  try {
    await handleDelete(id)
    deleteConfirmVisible.value = false
    pendingDeleteRow.value = null
  } finally {
    deletingUser.value = false
  }
}

const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) {
    return
  }

  await $trpc.sysUser.batchDelete.mutate(checkedRowKeys.value)
  await onBatchDeleted()
}

const openResetPassword = (row: SysUserTableRow) => {
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

/** 管理员手动解除登录失败锁定 */
const unlockUser = async (row: SysUserTableRow) => {
  if (!row.id) {
    return
  }

  await $trpc.sysUser.unlock.mutate(row.id)
  useToastSuccess($ts('module.system.user.unlockSuccess'))
  await refresh()
}

const handleExport = async () => {
  await downloadExcel('user', {
    ...searchParams.value,
    deptId: currentDeptId.value,
  })
  useToastSuccess($ts('module.system.excel.exportStarted'))
}

const openImport = () => {
  importFile.value = null
  importResult.value = null
  importVisible.value = true
}

const handleFileChange = (event: Event) => {
  const files = (event.target as HTMLInputElement).files
  importFile.value = files?.[0] ?? null
  importResult.value = null
}

const handleImport = async () => {
  if (!importFile.value) {
    return
  }

  importing.value = true
  try {
    importResult.value = await importExcel('user', importFile.value)
    if (importResult.value.successCount > 0) {
      await refresh()
    }
    useToastSuccess($ts('module.system.user.importDone', {
      success: importResult.value.successCount,
      failed: importResult.value.failedCount,
    }))
  } finally {
    importing.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    dictStore.loadDict(businessDictCode.enableStatus),
    dictStore.loadDict(businessDictCode.userGender)
  ])
  await search()
})
</script>

<template>
  <div class="h-full p-3">
    <SplitLayout
      :data="[]"
      :show-pagination="false"
      :default-width="300"
      :search-placeholder="$ts('common.keywordSearch')"
      :selected-label="selectedDeptLabel"
      @search="handleDeptSearch"
    >
      <template #sidebar>
        <DeptSideTree v-model:selected-id="selectedDeptId" :keyword="deptKeyword" @select="selectDept" />
      </template>

      <template #empty-content>
        <div class="flex h-full flex-col gap-3 overflow-hidden p-0 lg:p-3">
          <div class="flex-shrink-0">
            <SysUserSearch v-model:model="searchParams" @search="handleUserSearch" />
          </div>

          <UCard class="flex min-h-0 flex-1 flex-col overflow-hidden" :ui="{ body: 'flex flex-col h-full p-0 sm:p-0' }">
            <TableWithPagination
              ref="table"
              :data="data"
              :columns="columns"
              :loading="loading"
              :pagination="pagination"
              :page-size-options="pageSizeOptions"
              compact-mobile
              :mobile-actions-width="64"
              :mobile-row-actions="rowActions"
            >
              <template #header>
                <TableHeaderOperation
                  v-if="tableRef?.tableRef"
                  :table-ref="tableRef?.tableRef"
                  :loading="loading"
                  :disabled-delete="checkedRowKeys.length === 0 || loading"
                  :selected-count="checkedRowKeys.length"
                  :add-permission="userPermissions.codes.add"
                  :delete-permission="userPermissions.codes.del"
                  compact-mobile
                  class="border-b border-default px-4 py-2"
                  @add="handleAdd"
                  @delete="handleBatchDelete"
                  @refresh="refresh"
                >
                  <template #prefix>
                    <div class="hidden min-w-0 items-center gap-2 md:flex">
                      <span>{{ $ts('module.system.user.title') }}</span>
                      <UBadge color="neutral" variant="subtle" size="sm" class="max-w-40 truncate">
                        {{ selectedDeptLabel }}
                      </UBadge>
                    </div>
                  </template>

                  <template #suffix>
                    <UButton
                        v-if="userPermissions.canList.value"
                        color="neutral"
                        variant="outline"
                        icon="i-lucide-download"
                        :aria-label="$ts('module.system.excel.export')"
                        :title="$ts('module.system.excel.export')"
                        @click="handleExport"
                    >
                      <span class="hidden md:inline">{{ $ts('module.system.excel.export') }}</span>
                    </UButton>
                    <UButton
                        v-if="userPermissions.canAdd.value"
                        color="neutral"
                        variant="outline"
                        icon="i-lucide-upload"
                        :aria-label="$ts('module.system.excel.import')"
                        :title="$ts('module.system.excel.import')"
                        @click="openImport"
                    >
                      <span class="hidden md:inline">{{ $ts('module.system.excel.import') }}</span>
                    </UButton>
                  </template>
                </TableHeaderOperation>
              </template>
            </TableWithPagination>
          </UCard>
        </div>
      </template>
    </SplitLayout>

    <SysUserOperate
      v-model:visible="drawerVisible"
      :operate-type="operateType"
      :data="editingData ?? undefined"
      :default-dept-id="currentDeptId"
      :close="closeVisible"
      :refresh="refresh"
    />

    <UModal
      v-model:open="deleteConfirmVisible"
      :title="$ts('common.delete')"
      :ui="{ content: 'max-w-sm' }"
    >
      <template #body>
        <p class="text-sm text-default">
          {{ $ts('common.confirmDelete', { count: 1 }) }}
        </p>
      </template>
      <template #footer>
        <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" @click="deleteConfirmVisible = false" />
        <UButton :label="$ts('common.confirm')" color="error" :loading="deletingUser" @click="confirmDeleteUser" />
      </template>
    </UModal>

    <UModal
      v-model:open="resetPasswordVisible"
      :title="$ts('module.system.user.resetPassword')"
      :dismissible="false"
      :ui="{ content: 'max-w-md' }"
    >
      <template #body>
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-info"
          :title="$ts('module.system.user.resetPasswordSessionNotice')"
          class="mb-3"
        />
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
    <UModal
      v-model:open="importVisible"
      :title="$ts('module.system.excel.importUserTitle')"
      :dismissible="!importing"
      :ui="{ content: 'max-w-lg' }"
    >
      <template #body>
        <div class="space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <UButton color="neutral" variant="outline" icon="i-lucide-file-down" @click="downloadExcelTemplate('user')">
              {{ $ts('module.system.excel.downloadTemplate') }}
            </UButton>
            <input
                type="file"
                accept=".xlsx"
                class="block w-full max-w-xs text-sm text-muted file:mr-2 file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-sm file:text-default"
                @change="handleFileChange"
            >
          </div>

          <UAlert
              v-if="importResult"
              :color="importResult.failedCount > 0 ? 'warning' : 'success'"
              variant="subtle"
              :title="$ts('module.system.excel.importResult', { success: importResult.successCount, failed: importResult.failedCount })"
          />

          <div v-if="importResult?.errors.length" class="max-h-52 overflow-auto rounded-md border border-gray-200 p-2 text-xs dark:border-gray-800">
            <div v-for="item in importResult.errors" :key="item.row" class="py-0.5 text-error">
              {{ $ts('module.system.excel.importRowError', { row: item.row, message: item.message }) }}
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" :disabled="importing" @click="importVisible = false" />
        <UButton
            :label="$ts('common.confirm')"
            color="primary"
            :loading="importing"
            :disabled="!importFile"
            @click="handleImport"
        />
      </template>
    </UModal>
  </div>
</template>

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
