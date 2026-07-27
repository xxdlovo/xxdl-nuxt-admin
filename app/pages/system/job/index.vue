<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysJobSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
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
            :add-permission="jobPermissions.codes.add"
            :delete-permission="jobPermissions.codes.del"
            class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
            @add="handleAdd"
            @delete="handleBatchDelete"
            @refresh="refresh"
          >
            <template #prefix>
              <span>{{ $ts('module.system.job.title') }}</span>
            </template>
          </TableHeaderOperation>

          <SysJobOperate
            v-model:visible="drawerVisible"
            :operate-type="operateType"
            :data="editingData ?? undefined"
            :handlers="handlers"
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
  title: '任务管理',
  icon: 'i-lucide-timer'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysJobDto, SysJobHandlerDTO, SysJobQueryDTO } from '#shared/system/job'
import { JOB_RUNNING_STATUS_CONFIG, JOB_STATUS_CONFIG } from '#shared/constants/business'
import { customPermissionCode } from '#shared/auth'
import { useBadgeColumn, usePaginatedTable, useSelectionColumn, useTableOperate } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'
import SysJobSearch from './components/sys-job-search.vue'
import SysJobOperate from './components/sys-job-operate.vue'
import { useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const router = useRouter()
const tableRef = useTemplateRef('table')
const jobPermissions = useCrudPermissions('system:job')
const jobLogPermissions = useCrudPermissions('system:jobLog')
const { hasPermission, isAdmin } = useRbacProfile()
const runPermissionCode = customPermissionCode('system:job', 'run')
const canRun = computed(() => isAdmin.value || hasPermission(runPermissionCode))
const searchParams = ref<SysJobQueryDTO>({})
const handlers = ref<SysJobHandlerDTO[]>([])

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysJobDto>({
  query: params => $trpc.sysJob.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

const { operateType, editingData, drawerVisible, checkedRowKeys, handleAdd, handleEdit, onDeleted, onBatchDeleted, closeVisible } = useTableOperate<SysJobDto>({
  data,
  idKey: 'id',
  refresh
})

const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysJobDto>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

const handlerNameMap = computed(() => new Map(handlers.value.map(handler => [handler.code, handler.name])))

const columns = computed<TableColumn<SysJobDto>[]>(() => {
  const actionColumn: TableColumn<SysJobDto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      if (jobLogPermissions.canList.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'info',
          size: 'xs',
          icon: 'i-lucide-file-clock',
          onClick: () => handleViewLogs(row.original)
        }, { default: () => $ts('module.system.job.viewLogs') }))
      }

      if (canRun.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'success',
          size: 'xs',
          icon: 'i-lucide-play',
          onClick: () => handleRunNow(row.original)
        }, { default: () => $ts('module.system.job.runNow') }))
      }

      if (jobPermissions.canEdit.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          icon: 'i-lucide-pencil',
          onClick: () => handleEdit(row.original.id as string)
        }, { default: () => $ts('common.edit') }))

        const enabled = row.original.status === 1
        actions.push(h(UButton, {
          variant: 'outline',
          color: enabled ? 'warning' : 'success',
          size: 'xs',
          icon: enabled ? 'i-lucide-pause' : 'i-lucide-play',
          onClick: () => handleToggleStatus(row.original)
        }, { default: () => enabled ? $ts('module.system.job.disable') : $ts('module.system.job.enable') }))
      }

      if (jobPermissions.canDel.value) {
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

      return h('div', { class: 'flex flex-wrap gap-2' }, actions)
    }
  }

  return [
    ...(jobPermissions.canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => h('span', { class: 'text-muted' }, (pagination.page - 1) * pagination.pageSize + row.index + 1)
    },
    {
      accessorKey: 'jobName',
      header: () => $ts('module.system.job.jobName')
    },
    {
      accessorKey: 'jobCode',
      header: () => $ts('module.system.job.jobCode')
    },
    {
      accessorKey: 'handlerCode',
      header: () => $ts('module.system.job.handlerCode'),
      cell: ({ row }) => handlerNameMap.value.get(row.original.handlerCode || '') || row.original.handlerCode || '-'
    },
    {
      accessorKey: 'cronExpression',
      header: () => $ts('module.system.job.cronExpression')
    },
    useBadgeColumn<SysJobDto>('status', 'module.system.job.status', JOB_STATUS_CONFIG, 1),
    useBadgeColumn<SysJobDto>('runningStatus', 'module.system.job.runningStatus.title', JOB_RUNNING_STATUS_CONFIG, 0),
    {
      accessorKey: 'nextRunAt',
      header: () => $ts('module.system.job.nextRunAt')
    },
    {
      accessorKey: 'lastRunAt',
      header: () => $ts('module.system.job.lastRunAt')
    },
    ...(jobPermissions.canOperate.value || canRun.value || jobLogPermissions.canList.value ? [actionColumn] : [])
  ]
})

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysJob.remove.mutate(id)
  await onDeleted()
}

const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) return
  await $trpc.sysJob.batchDelete.mutate(checkedRowKeys.value)
  await onBatchDeleted()
}

const handleToggleStatus = async (job: SysJobDto) => {
  if (loading.value || !job.id) return
  if (job.status === 1) {
    await $trpc.sysJob.disable.mutate({ id: job.id })
  } else {
    await $trpc.sysJob.enable.mutate({ id: job.id })
  }
  useToastSuccess($ts('common.modifySuccess'))
  await refresh()
}

const handleRunNow = async (job: SysJobDto) => {
  if (loading.value || !job.id) return
  await $trpc.sysJob.runNow.mutate(job.id)
  useToastSuccess($ts('module.system.job.runSuccess'))
  await refresh()
}

const handleViewLogs = async (job: SysJobDto) => {
  if (!job.id) return
  await router.push({
    path: '/system/job-log',
    query: {
      jobId: job.id,
      jobName: job.jobName || undefined
    }
  })
}

onMounted(async () => {
  handlers.value = await $trpc.sysJob.availableHandlers.query()
  await search()
})
</script>
