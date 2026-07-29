<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysJobLogSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
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
            :add-permission="undefined"
            :delete-permission="logPermissions.codes.del"
            class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
            @delete="handleBatchDelete"
            @refresh="refresh"
          >
            <template #prefix>
              <span>{{ $ts('module.system.jobLog.title') }}</span>
            </template>
            <template #default>
              <UPopover v-model:open="showDeletePopover">
                <UButton
                  v-permission="logPermissions.codes.del"
                  variant="outline"
                  color="error"
                  :disabled="checkedRowKeys.length === 0 || loading"
                >
                  <template #leading>
                    <UIcon name="i-ic-round-delete" class="w-4 h-4" />
                  </template>
                  {{ $ts('common.batchDelete') }}
                </UButton>

                <template #content>
                  <div class="p-3">
                    <p class="text-sm text-gray-600 mb-3">
                      {{ $ts('common.confirmDelete', { count: checkedRowKeys.length }) }}
                    </p>
                    <div class="flex justify-end gap-2">
                      <UButton variant="ghost" color="neutral" @click="showDeletePopover = false">
                        {{ $ts('common.cancel') }}
                      </UButton>
                      <UButton color="error" @click="handleBatchDelete">
                        {{ $ts('common.confirm') }}
                      </UButton>
                    </div>
                  </div>
                </template>
              </UPopover>
            </template>

          </TableHeaderOperation>

          <SysJobLogDetail v-model:visible="detailVisible" :data="detailData" />
        </template>
      </TableWithPagination>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '任务日志',
  icon: 'i-lucide-file-clock'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysJobLogDto, SysJobLogQueryDTO } from '#shared/system/jobLog'
import { businessDictCode } from '#shared/constants/business'
import { useBadgeColumn, usePaginatedTable, useSelectionColumn, useTableOperate } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'
import SysJobLogSearch from './components/sys-job-log-search.vue'
import SysJobLogDetail from './components/sys-job-log-detail.vue'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const route = useRoute()
const tableRef = useTemplateRef('table')
const logPermissions = useCrudPermissions('system:jobLog')
const searchParams = ref<SysJobLogQueryDTO>({
  jobId: typeof route.query.jobId === 'string' ? route.query.jobId : undefined
})
const detailVisible = ref(false)
const detailData = ref<SysJobLogDto | null>(null)
const showDeletePopover = ref(false)
const jobLogStatusConfig = useDictBadgeConfig(businessDictCode.jobLogStatus)

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysJobLogDto>({
  query: params => $trpc.sysJobLog.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

const { checkedRowKeys, onDeleted, onBatchDeleted } = useTableOperate<SysJobLogDto>({
  data,
  idKey: 'id',
  refresh
})

const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysJobLogDto>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

const handleDetail = (row: SysJobLogDto) => {
  detailData.value = JSON.parse(JSON.stringify(row))
  detailVisible.value = true
}

const columns = computed<TableColumn<SysJobLogDto>[]>(() => {
  const actionColumn: TableColumn<SysJobLogDto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = [
        h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          icon: 'i-lucide-eye',
          onClick: () => handleDetail(row.original)
        }, { default: () => $ts('common.detail') })
      ]

      if (logPermissions.canDel.value) {
        actions.push(h(Popconfirm, {
          onConfirm: () => handleDelete(row.original.id as string)
        }, {
          trigger: () => h(UButton, {
            variant: 'outline',
            color: 'error',
            size: 'xs',
            icon: 'i-lucide-trash-2'
          }, { default: () => $ts('common.delete') })
        }))
      }

      return h('div', { class: 'flex gap-2' }, actions)
    }
  }

  return [
    ...(logPermissions.canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => h('span', { class: 'text-muted' }, (pagination.page - 1) * pagination.pageSize + row.index + 1)
    },
    {
      accessorKey: 'jobName',
      header: () => $ts('module.system.jobLog.jobName')
    },
    {
      accessorKey: 'jobCode',
      header: () => $ts('module.system.jobLog.jobCode')
    },
    {
      accessorKey: 'triggerType',
      header: () => $ts('module.system.jobLog.triggerType.title')
    },
    useBadgeColumn<SysJobLogDto>('status', 'module.system.jobLog.logStatus', jobLogStatusConfig.value, 0),
    {
      accessorKey: 'startedAt',
      header: () => $ts('module.system.jobLog.startedAt')
    },
    {
      accessorKey: 'finishedAt',
      header: () => $ts('module.system.jobLog.finishedAt')
    },
    {
      accessorKey: 'durationMs',
      header: () => $ts('module.system.jobLog.durationMs'),
      cell: ({ row }) => row.original.durationMs == null ? '-' : `${row.original.durationMs}ms`
    },
    actionColumn
  ]
})

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysJobLog.remove.mutate(id)
  await onDeleted()
}

const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) return
  await $trpc.sysJobLog.batchDelete.mutate(checkedRowKeys.value)
  showDeletePopover.value = false
  await onBatchDeleted()
}

watch(
  () => route.query.jobId,
  async (jobId) => {
    searchParams.value = {
      ...searchParams.value,
      jobId: typeof jobId === 'string' ? jobId : undefined
    }
    await getDataByPage(1, searchParams.value)
  }
)

onMounted(async () => {
  await getDataByPage(1, searchParams.value)
})
</script>
