<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysPayChannelSearch v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
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
            :add-permission="channelPermissions.codes.add"
            :delete-permission="channelPermissions.codes.del"
            class="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
            @add="handleAdd"
            @delete="handleBatchDelete"
            @refresh="refresh"
          >
            <template #prefix>
              <span>{{ $ts('module.system.payChannel.title') }}</span>
            </template>

            <SysPayChannelOperate
              v-model:visible="drawerVisible"
              :operate-type="operateType"
              :data="editingData ?? undefined"
              :close="closeVisible"
              :refresh="refresh"
            />
          </TableHeaderOperation>
        </template>
      </TableWithPagination>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '支付渠道配置',
  icon: 'i-lucide-wallet'
})

import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysPayChannelDto, SysPayChannelQueryDTO } from '#shared/system/payChannel'
import {
  businessDictCode,
  payChannelCodeRecord,
  payChannelModeRecord,
  payChannelVerifyConfig
} from '#shared/constants/business'
import { usePaginatedTable, useTableOperate, useBadgeColumn, useSelectionColumn } from '~/composables/useTable'
import TableWithPagination from '~/components/table/TableWithPagination.vue'
import SysPayChannelSearch from './components/sys-pay-channel-search.vue'
import SysPayChannelOperate from './components/sys-pay-channel-operate.vue'
import { useToastError, useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const channelPermissions = useCrudPermissions('system:payChannel')
const searchParams = ref<SysPayChannelQueryDTO>({})
const enableStatusConfig = useDictBadgeConfig(businessDictCode.enableStatus)
const noYesConfig = useDictBadgeConfig(businessDictCode.noYes)

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysPayChannelDto>({
  query: params => $trpc.sysPayChannel.page.query(params),
  pageSizeOptions: [10, 20, 50, 100]
})

const { operateType, editingData, drawerVisible, checkedRowKeys, handleAdd, handleEdit, onDeleted, onBatchDeleted, closeVisible } = useTableOperate<SysPayChannelDto>({
  data,
  idKey: 'id',
  refresh
})

const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysPayChannelDto>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

/** 渠道平台与运行模式用本文案映射，避免依赖可被后台改坏的字典 */
const channelLabel = (code?: string | null) => {
  if (!code) return ''
  const key = payChannelCodeRecord[code]
  return key ? $ts(key) : code
}

const modeLabel = (mode?: string | null) => {
  if (!mode) return ''
  const key = payChannelModeRecord[mode]
  return key ? $ts(key) : mode
}

const handleVerify = async (channel: SysPayChannelDto) => {
  if (!channel.id) return

  const result = await $trpc.sysPayChannel.verify.mutate(channel.id)

  if (result.success) {
    useToastSuccess(result.message)
  } else {
    useToastError($ts('module.system.payChannel.verifyFailed'), undefined, result.message)
  }

  await refresh()
}

const handleSetDefault = async (channel: SysPayChannelDto) => {
  if (!channel.id) return

  await $trpc.sysPayChannel.setDefault.mutate(channel.id)
  useToastSuccess($ts('module.system.payChannel.setDefaultSuccess'))
  await refresh()
}

const columns = computed<TableColumn<SysPayChannelDto>[]>(() => {
  const actionColumn: TableColumn<SysPayChannelDto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      if (channelPermissions.canEdit.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          onClick: () => handleEdit(row.original.id as string)
        }, { default: () => $ts('common.edit') }))
      }

      actions.push(h(UButton, {
        variant: 'outline',
        color: 'neutral',
        size: 'xs',
        onClick: () => handleVerify(row.original)
      }, { default: () => $ts('module.system.payChannel.testConfig') }))

      if (!row.original.isDefault) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'success',
          size: 'xs',
          onClick: () => handleSetDefault(row.original)
        }, { default: () => $ts('module.system.payChannel.setDefault') }))
      }

      if (channelPermissions.canDel.value) {
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
    ...(channelPermissions.canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => h('span', { class: 'text-muted' }, (pagination.page - 1) * pagination.pageSize + row.index + 1)
    },
    {
      accessorKey: 'configName',
      header: () => $ts('module.system.payChannel.configName')
    },
    {
      accessorKey: 'configKey',
      header: () => $ts('module.system.payChannel.configKey')
    },
    {
      accessorKey: 'channelCode',
      header: () => $ts('module.system.payChannel.channelCode'),
      cell: ({ row }) => channelLabel(row.original.channelCode)
    },
    {
      accessorKey: 'mode',
      header: () => $ts('module.system.payChannel.modeLabel'),
      cell: ({ row }) => modeLabel(row.original.mode)
    },
    {
      accessorKey: 'currency',
      header: () => $ts('module.system.payChannel.currency')
    },
    useBadgeColumn<SysPayChannelDto>('isDefault', 'module.system.payChannel.isDefault', noYesConfig.value, 0),
    useBadgeColumn<SysPayChannelDto>('verifyStatus', 'module.system.payChannel.verifyStatus', payChannelVerifyConfig, 0),
    useBadgeColumn<SysPayChannelDto>('status', 'module.system.payChannel.status', enableStatusConfig.value, 1),
    {
      accessorKey: 'sortOrder',
      header: () => $ts('module.system.payChannel.sortOrder')
    },
    ...(channelPermissions.canOperate.value ? [actionColumn] : [])
  ]
})

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.sysPayChannel.remove.mutate(id)
  await onDeleted()
}

const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) {
    return
  }
  await $trpc.sysPayChannel.batchDelete.mutate(checkedRowKeys.value)
  await onBatchDeleted()
}

onMounted(async () => {
  await search()
})
</script>
