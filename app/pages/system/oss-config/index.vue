<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysOssConfigSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
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
            :add-permission="ossConfigPermissions.codes.add"
            :delete-permission="ossConfigPermissions.codes.del"
            class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
          >
            <template #prefix>
              <span>{{ $ts('module.system.ossConfig.title') }}</span>
            </template>
          </TableHeaderOperation>

          <SysOssConfigOperate
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
  title: '存储配置',
  icon: 'i-lucide-hard-drive'
})

import type { TableColumn } from '@nuxt/ui'
import type { Component } from 'vue'
import { h } from 'vue'
import type { SysOssConfigDto, SysOssConfigQueryDTO } from '#shared/system/ossConfig'
import SysOssConfigSearch from './components/sys-oss-config-search.vue'
import SysOssConfigOperate from './components/sys-oss-config-operate.vue'
import { businessDictCode } from '#shared/constants/business'
import { useBadgeColumn, usePaginatedTable, useSelectionColumn, useTableOperate } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'
import { useToastError, useToastSuccess, useToastWarning } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const ossConfigPermissions = useCrudPermissions('system:ossConfig')
const accessPolicyConfig = useDictBadgeConfig(businessDictCode.ossAccessPolicy)
const noYesConfig = useDictBadgeConfig(businessDictCode.noYes)
const verifyStatusConfig = useDictBadgeConfig(businessDictCode.ossVerifyStatus)
const enableStatusConfig = useDictBadgeConfig(businessDictCode.enableStatus)

const searchParams = ref<SysOssConfigQueryDTO>({})
const verifyingId = ref<string | null>(null)

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysOssConfigDto>({
  query: params => $trpc.sysOssConfig.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

const { operateType, editingData, drawerVisible, checkedRowKeys, handleAdd, handleEdit, onDeleted, onBatchDeleted, closeVisible } = useTableOperate<SysOssConfigDto>({
  data,
  idKey: 'id',
  refresh
})

const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysOssConfigDto>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

const columns = computed<TableColumn<SysOssConfigDto>[]>(() => {
  const actionColumn: TableColumn<SysOssConfigDto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      if (row.original.verifyStatus !== 1) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: row.original.verifyStatus === 2 ? 'warning' : 'primary',
          icon: 'i-lucide-shield-check',
          loading: verifyingId.value === row.original.id,
          disabled: Boolean(verifyingId.value),
          onClick: () => handleVerify(row.original.id as string)
        }, { default: () => $ts('module.system.ossConfig.verify') }))
      } else {
        actions.push(h(UButton, {
          variant: 'subtle',
          color: 'success',
          icon: 'i-lucide-badge-check',
          disabled: true
        }, { default: () => $ts('module.system.ossConfig.verified') }))
      }

      if (ossConfigPermissions.canEdit.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          icon: 'i-ic-round-edit',
          onClick: () => handleEdit(row.original.id as string)
        }, { default: () => $ts('common.edit') }))
      }

      if (ossConfigPermissions.canDel.value) {
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
    ...(ossConfigPermissions.canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => {
        const index = (pagination.page - 1) * pagination.pageSize + row.index + 1
        return h('span', { class: 'text-gray-500 dark:text-gray-400' }, index)
      }
    },
    {
      accessorKey: 'configKey',
      header: () => $ts('module.system.ossConfig.configKey')
    },
    {
      accessorKey: 'configName',
      header: () => $ts('module.system.ossConfig.configName')
    },
    {
      accessorKey: 'service',
      header: () => $ts('module.system.ossConfig.service')
    },
    {
      accessorKey: 'endpoint',
      header: () => $ts('module.system.ossConfig.endpoint')
    },
    {
      accessorKey: 'bucketName',
      header: () => $ts('module.system.ossConfig.bucketName')
    },
    useBadgeColumn<SysOssConfigDto>(
      'accessPolicy',
      'module.system.ossConfig.accessPolicy',
      accessPolicyConfig.value,
      1
    ),
    useBadgeColumn<SysOssConfigDto>(
      'isDefault',
      'module.system.ossConfig.isDefault',
      noYesConfig.value,
      0
    ),
    useBadgeColumn<SysOssConfigDto>(
      'verifyStatus',
      'module.system.ossConfig.verifyStatus',
      verifyStatusConfig.value,
      0
    ),
    useBadgeColumn<SysOssConfigDto>(
      'status',
      'module.system.ossConfig.configStatus',
      enableStatusConfig.value,
      1
    ),
    ...(ossConfigPermissions.canOperate.value ? [actionColumn] : [])
  ]
})

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysOssConfig.remove.mutate(id)
  await onDeleted()
}

const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) return
  await $trpc.sysOssConfig.batchDelete.mutate(checkedRowKeys.value)
  await onBatchDeleted()
}

const handleVerify = async (id: string) => {
  if (loading.value || verifyingId.value) return

  verifyingId.value = id
  try {
    const result = await $trpc.sysOssConfig.verify.mutate(id)
    if (result.success) {
      useToastSuccess($ts('module.system.ossConfig.verifySuccess'))
    } else {
      useToastWarning($ts('module.system.ossConfig.verifyFailed'), 5000, result.message)
    }
    await refresh()
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    useToastError($ts('module.system.ossConfig.verifyFailed'), 5000, message)
  } finally {
    verifyingId.value = null
  }
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
    min-width: 960px;
  }
}
</style>
