<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysNoticeSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
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
            :add-permission="noticePermissions.codes.add"
            :delete-permission="noticePermissions.codes.del"
            class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
            @add="handleAdd"
            @delete="handleBatchDelete"
            @refresh="refresh"
          >
            <template #prefix>
              <span>{{ $ts('module.system.notice.title') }}</span>
            </template>
          </TableHeaderOperation>

          <SysNoticeOperate
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
  title: '通知公告',
  icon: 'i-lucide-megaphone'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysNoticeDto, SysNoticeQueryDTO } from '#shared/system/notice'
import { NOTICE_PUBLISH_STATUS_CONFIG, NOTICE_TYPE_CONFIG, TOP_FLAG_CONFIG } from '#shared/constants/business'
import { usePaginatedTable, useTableOperate, useBadgeColumn, useSelectionColumn } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'
import SysNoticeSearch from './components/sys-notice-search.vue'
import SysNoticeOperate from './components/sys-notice-operate.vue'
import { useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const noticePermissions = useCrudPermissions('system:notice')
const searchParams = ref<SysNoticeQueryDTO>({})

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysNoticeDto>({
  query: params => $trpc.sysNotice.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

const { operateType, editingData, drawerVisible, checkedRowKeys, handleAdd, handleEdit, onDeleted, onBatchDeleted, closeVisible } = useTableOperate<SysNoticeDto>({
  data,
  idKey: 'id',
  refresh
})

const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysNoticeDto>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

const columns = computed<TableColumn<SysNoticeDto>[]>(() => {
  const actionColumn: TableColumn<SysNoticeDto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      if (noticePermissions.canEdit.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          onClick: () => handleEdit(row.original.id as string)
        }, { default: () => $ts('common.edit') }))

        const isPublished = row.original.publishStatus === 1
        actions.push(h(UButton, {
          variant: 'outline',
          color: isPublished ? 'warning' : 'success',
          size: 'xs',
          onClick: () => handleTogglePublish(row.original)
        }, { default: () => isPublished ? $ts('module.system.notice.withdraw') : $ts('module.system.notice.publish') }))
      }

      if (noticePermissions.canDel.value) {
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
    ...(noticePermissions.canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => h('span', { class: 'text-muted' }, (pagination.page - 1) * pagination.pageSize + row.index + 1)
    },
    {
      accessorKey: 'title',
      header: () => $ts('module.system.notice.noticeTitle')
    },
    useBadgeColumn<SysNoticeDto>('noticeType', 'module.system.notice.noticeType', NOTICE_TYPE_CONFIG, 1),
    useBadgeColumn<SysNoticeDto>('publishStatus', 'module.system.notice.status', NOTICE_PUBLISH_STATUS_CONFIG, 1),
    useBadgeColumn<SysNoticeDto>('topFlag', 'module.system.notice.topFlag', TOP_FLAG_CONFIG, 0),
    {
      accessorKey: 'publishTime',
      header: () => $ts('module.system.notice.publishTime')
    },
    {
      accessorKey: 'sortOrder',
      header: () => $ts('module.system.notice.sortOrder')
    },
    ...(noticePermissions.canOperate.value ? [actionColumn] : [])
  ]
})

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysNotice.remove.mutate(id)
  await onDeleted()
}

const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) {
    return
  }
  await $trpc.sysNotice.batchDelete.mutate(checkedRowKeys.value)
  await onBatchDeleted()
}

const handleTogglePublish = async (notice: SysNoticeDto) => {
  if (loading.value || !notice.id) {
    return
  }

  await $trpc.sysNotice.updatePublishStatus.mutate({
    id: notice.id,
    publishStatus: notice.publishStatus === 1 ? 2 : 1
  })
  useToastSuccess($ts('common.modifySuccess'))
  await refresh()
}

onMounted(async () => {
  await search()
})
</script>
