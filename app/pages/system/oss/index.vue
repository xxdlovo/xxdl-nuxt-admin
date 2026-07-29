<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysOssSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
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
            @add="handleAdd"
            @delete="handleBatchDelete"
            @refresh="refresh"
            :tableRef="tableRef?.tableRef"
            :loading="loading"
            :disabledDelete="checkedRowKeys.length === 0 || loading"
            :selectedCount="checkedRowKeys.length"
            :add-permission="ossPermissions.codes.add"
            :delete-permission="ossPermissions.codes.del"
            :add-label="$ts('module.system.oss.upload')"
            add-icon="i-lucide-upload"
            class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
          >
            <template #prefix>
              <span>{{ $ts('module.system.oss.title') }}</span>
            </template>
          </TableHeaderOperation>

          <SysOssOperate
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
  title: '文件管理',
  icon: 'i-lucide-folder-open'
})

import type { TableColumn } from '@nuxt/ui'
import type { Component } from 'vue'
import { h } from 'vue'
import type { SysOssDto, SysOssQueryDTO } from '#shared/system/oss'
import SysOssSearch from './components/sys-oss-search.vue'
import SysOssOperate from './components/sys-oss-operate.vue'
import { businessDictCode } from '#shared/constants/business'
import { useBadgeColumn, usePaginatedTable, useSelectionColumn, useTableOperate } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'
import { useToastSuccess, useToastWarning } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const ossPermissions = useCrudPermissions('system:oss')
const enableStatusConfig = useDictBadgeConfig(businessDictCode.enableStatus)

const searchParams = ref<SysOssQueryDTO>({})

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysOssDto>({
  query: params => $trpc.sysOss.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

const { operateType, editingData, drawerVisible, checkedRowKeys, handleAdd, onDeleted, onBatchDeleted, closeVisible } = useTableOperate<SysOssDto>({
  data,
  idKey: 'id',
  refresh
})

const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysOssDto>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

const formatFileSize = (size?: number | null) => {
  const value = Number(size || 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB`
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const downloadFile = (row: SysOssDto) => {
  if (!row.url) {
    useToastWarning($ts('module.system.oss.linkEmpty'))
    return
  }

  const link = document.createElement('a')
  link.href = row.url
  link.download = row.originalName || row.fileName || ''
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

const copyLink = async (url?: string | null) => {
  if (!url) {
    useToastWarning($ts('module.system.oss.linkEmpty'))
    return
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url)
  } else {
    const textarea = document.createElement('textarea')
    textarea.value = url
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }

  useToastSuccess($ts('common.copySuccess'))
}

const columns = computed<TableColumn<SysOssDto>[]>(() => {
  const actionColumn: TableColumn<SysOssDto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      actions.push(h(UButton, {
        variant: 'outline',
        color: 'neutral',
        size: 'xs',
        icon: 'i-lucide-download',
        disabled: !row.original.url,
        onClick: () => downloadFile(row.original)
      }, { default: () => $ts('module.system.oss.download') }))

      actions.push(h(UButton, {
        variant: 'outline',
        color: 'primary',
        size: 'xs',
        icon: 'i-lucide-copy',
        disabled: !row.original.url,
        onClick: () => copyLink(row.original.url)
      }, { default: () => $ts('module.system.oss.copyLink') }))

      if (ossPermissions.canDel.value) {
        actions.push(h(Popconfirm, {
          onConfirm: () => handleDelete(row.original.id as string)
        }, {
          trigger: () => h(UButton, {
            variant: 'outline',
            color: 'error',
            size: 'xs',
            icon: 'i-ic-round-delete'
          }, { default: () => $ts('common.delete') })
        }))
      }

      return h('div', { class: 'flex flex-wrap gap-2' }, actions)
    }
  }

  return [
    ...(ossPermissions.canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => {
        const index = (pagination.page - 1) * pagination.pageSize + row.index + 1
        return h('span', { class: 'text-gray-500 dark:text-gray-400' }, index)
      }
    },
    {
      accessorKey: 'originalName',
      header: () => $ts('module.system.oss.originalName')
    },
    {
      accessorKey: 'fileName',
      header: () => $ts('module.system.oss.fileName')
    },
    {
      accessorKey: 'fileSize',
      header: () => $ts('module.system.oss.fileSize'),
      cell: ({ row }) => formatFileSize(row.original.fileSize)
    },
    {
      accessorKey: 'service',
      header: () => $ts('module.system.oss.service')
    },
    {
      accessorKey: 'bucketName',
      header: () => $ts('module.system.oss.bucketName')
    },
    {
      accessorKey: 'createdAt',
      header: () => $ts('module.system.oss.createdAt')
    },
    useBadgeColumn<SysOssDto>(
      'status',
      'module.system.oss.ossStatus',
      enableStatusConfig.value,
      1
    ),
    ...(ossPermissions.canOperate.value ? [actionColumn] : [])
  ]
})

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysOss.remove.mutate(id)
  await onDeleted()
}

const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) return
  await $trpc.sysOss.batchDelete.mutate(checkedRowKeys.value)
  await onBatchDeleted()
}

onMounted(async () => {
  await search()
})
</script>

<style scoped>
:deep(.overflow-auto) {
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 640px) {
  :deep(table) {
    display: table;
    width: 100%;
    min-width: 860px;
  }
}
</style>
