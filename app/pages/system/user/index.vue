<script setup lang="ts">
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import { SysUserResetPasswordSchema, type SysUserQueryDTO, type SysUserResetPasswordDTO } from '#shared/system/user'
import type { SysUserDto } from '#shared/system/user/common'
import SysUserSearch from './components/sys-user-search.vue'
import SysUserOperate from './components/sys-user-operate.vue'
import DeptSideTree, { type DeptTreeItem } from '../dept/components/DeptSideTree.vue'
import { businessDictCode } from '#shared/constants/business'
import { usePaginatedTable, useTableOperate, useBadgeColumn, useSelectionColumn } from '~/composables/useTable'
import { useToastSuccess } from '~/utils/toast'
import TableWithPagination from '~/components/table/TableWithPagination.vue'

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
const resetPasswordState = ref<SysUserResetPasswordDTO>({
  id: '',
  password: '',
  confirmPassword: ''
})

const searchParams = ref<SysUserQueryDTO>({})

const currentDeptId = computed(() => selectedDeptId.value || undefined)

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
  const actionColumn: TableColumn<SysUserTableRow> = {
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
    ...(userPermissions.canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => {
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
    {
      accessorKey: 'deptName',
      header: () => $ts('module.system.user.userDept'),
      cell: ({ row }) => h('span', { class: 'text-muted' }, row.original.deptName || row.original.deptCode || '-')
    },
    useBadgeColumn<SysUserTableRow>(
      'gender',
      'module.system.user.userGender',
      userGenderConfig.value,
      0
    ),
    {
      accessorKey: 'email',
      header: () => $ts('module.system.user.userEmail')
    },
    useBadgeColumn<SysUserTableRow>(
      'status',
      'module.system.user.userStatus',
      enableStatusConfig.value,
      1
    ),
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
                  class="border-b border-default px-4 py-2"
                  @add="handleAdd"
                  @delete="handleBatchDelete"
                  @refresh="refresh"
                >
                  <template #prefix>
                    <div class="flex min-w-0 items-center gap-2">
                      <span>{{ $ts('module.system.user.title') }}</span>
                      <UBadge color="neutral" variant="subtle" size="sm" class="max-w-40 truncate">
                        {{ selectedDeptLabel }}
                      </UBadge>
                    </div>
                  </template>
                </TableHeaderOperation>

                <SysUserOperate
                  v-model:visible="drawerVisible"
                  :operate-type="operateType"
                  :data="editingData ?? undefined"
                  :default-dept-id="currentDeptId"
                  :close="closeVisible"
                  :refresh="refresh"
                />
              </template>
            </TableWithPagination>
          </UCard>
        </div>
      </template>
    </SplitLayout>

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
