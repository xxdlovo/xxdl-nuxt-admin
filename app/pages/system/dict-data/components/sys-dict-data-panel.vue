<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <div class="flex-shrink-0">
      <SysDictDataSearch
        v-model:model="searchParams"
        :fixed-type-id="typeId"
        @search="handleSearch"
      />
    </div>

    <UCard class="flex-1 min-h-0 flex flex-col overflow-hidden" :ui="{ body: 'flex flex-col h-full p-0 sm:p-0' }">
      <TableWithPagination
        v-if="loading || data.length > 0"
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
            :add-permission="dictDataPermissions.codes.add"
            :delete-permission="dictDataPermissions.codes.del"
            class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
            @add="handleAdd"
            @delete="handleBatchDelete"
            @refresh="loadData"
          >
            <template #prefix>
              <span>{{ $ts('module.system.dictData.title') }}</span>
            </template>
          </TableHeaderOperation>
        </template>
      </TableWithPagination>

      <div v-else class="flex h-full min-h-0 flex-col">
        <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div class="flex flex-wrap items-center gap-2">
            <span>{{ $ts('module.system.dictData.title') }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-permission="dictDataPermissions.codes.add"
              variant="outline"
              color="primary"
              icon="i-ic-round-plus"
              @click="handleAdd"
            >
              {{ $ts('common.add') }}
            </UButton>
            <UButton
              variant="outline"
              color="neutral"
              icon="i-mdi-refresh"
              @click="loadData"
            >
              {{ $ts('common.refresh') }}
            </UButton>
          </div>
        </div>
        <div class="flex flex-1 items-center justify-center p-6">
          <UEmpty
            icon="i-lucide-database"
            :title="$ts('module.system.dictData.emptyTitle')"
            :description="$ts('module.system.dictData.emptyDesc')"
            variant="naked"
          />
        </div>
      </div>
    </UCard>

    <SysDictDataOperate
      v-model:visible="drawerVisible"
      :operate-type="operateType"
      :data="editingData ?? undefined"
      :default-type-id="typeId"
      :disable-type-id="Boolean(typeId)"
      :close="closeVisible"
      :refresh="loadData"
    />
  </div>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysDictDataDto, SysDictDataQueryDTO } from '#shared/system/dictData'
import { ENABLE_STATUS_CONFIG } from '#shared/constants/business'
import { useBadgeColumn, useSelectionColumn, useTableOperate } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'
import TableHeaderOperation from '~/components/table/TableHeaderOperation.vue'
import SysDictDataSearch from './sys-dict-data-search.vue'
import SysDictDataOperate from './sys-dict-data-operate.vue'

const props = defineProps<{
  typeId?: string
}>()

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const dictDataPermissions = useCrudPermissions('system:dictData')
const pageSizeOptions = [10, 20, 50, 100]

const data = ref<SysDictDataDto[]>([])
const loading = ref(false)
const searchParams = ref<SysDictDataQueryDTO>({})
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const {
  operateType,
  editingData,
  drawerVisible,
  checkedRowKeys,
  handleAdd,
  handleEdit,
  closeVisible,
  onDeleted,
  onBatchDeleted
} = useTableOperate<SysDictDataDto>({
  data,
  idKey: 'id',
  refresh: async () => {
    await loadData()
  }
})

const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysDictDataDto>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

const columns = computed<TableColumn<SysDictDataDto>[]>(() => {
  const actionColumn: TableColumn<SysDictDataDto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      if (dictDataPermissions.canEdit.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          onClick: () => handleEdit(row.original.id as string)
        }, { default: () => $ts('common.edit') }))
      }

      if (dictDataPermissions.canDel.value) {
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

  const baseColumns: TableColumn<SysDictDataDto>[] = [
    ...(dictDataPermissions.canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => {
        const index = (pagination.page - 1) * pagination.pageSize + row.index + 1
        return h('span', { class: 'text-gray-500 dark:text-gray-400' }, index)
      }
    }
  ]

  if (!props.typeId) {
    baseColumns.push({
      accessorKey: 'typeId',
      header: () => $ts('module.system.dictData.typeId')
    })
  }

  return [
    ...baseColumns,
    {
      accessorKey: 'label',
      header: () => $ts('module.system.dictData.label')
    },
    {
      accessorKey: 'value',
      header: () => $ts('module.system.dictData.value')
    },
    {
      accessorKey: 'sortOrder',
      header: () => $ts('module.system.dictData.sortOrder')
    },
    useBadgeColumn<SysDictDataDto>(
      'status',
      'module.system.dictData.dictStatus',
      ENABLE_STATUS_CONFIG,
      1
    ),
    ...(dictDataPermissions.canOperate.value ? [actionColumn] : [])
  ]
})

const loadData = async () => {
  loading.value = true
  try {
    const result = await $trpc.sysDictData.page.query({
      ...searchParams.value,
      typeId: props.typeId || searchParams.value.typeId,
      page: pagination.page,
      pageSize: pagination.pageSize
    })
    data.value = result.list
    pagination.page = result.page
    pagination.pageSize = result.pageSize
    pagination.total = result.total
  } finally {
    loading.value = false
  }
}

const handleSearch = async (value: SysDictDataQueryDTO) => {
  searchParams.value = {
    ...value,
    typeId: props.typeId || value.typeId
  }
  pagination.page = 1
  await loadData()
}

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysDictData.remove.mutate(id)
  await onDeleted()
}

const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) return
  await $trpc.sysDictData.batchDelete.mutate(checkedRowKeys.value)
  await onBatchDeleted()
}

watch(
  () => [pagination.page, pagination.pageSize],
  async ([page, pageSize], [oldPage, oldPageSize]) => {
    if (page !== oldPage || pageSize !== oldPageSize) {
      await loadData()
    }
  }
)

watch(
  () => props.typeId,
  async (typeId) => {
    checkedRowKeys.value = []
    searchParams.value = {
      typeId: typeId || undefined
    }
    pagination.page = 1
    await loadData()
  }
)

onMounted(async () => {
  searchParams.value = {
    typeId: props.typeId || undefined
  }
  await loadData()
})
</script>
