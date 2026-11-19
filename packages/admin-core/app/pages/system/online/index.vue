<template>
  <div class="h-full flex flex-col gap-3 p-3">
    <!-- 搜索 -->
    <FilterPanel
      storage-key="sys-online-search-fab-pos"
      @search="handleSearch"
      @reset="handleReset"
    >
      <div class="grid grid-cols-1 gap-4 px-2 pb-1 sm:grid-cols-2">
        <UFormField :label="$ts('module.system.online.search.userName')" orientation="horizontal" :ui="onlineFormItemUi">
          <UInput v-model="filters.username" :placeholder="$ts('module.system.online.search.userName')" icon="i-lucide-user" class="w-full" @keyup.enter="handleSearch" />
        </UFormField>
        <UFormField :label="$ts('module.system.online.search.ip')" orientation="horizontal" :ui="onlineFormItemUi">
          <UInput v-model="filters.ip" :placeholder="$ts('module.system.online.search.ip')" icon="i-lucide-network" class="w-full" @keyup.enter="handleSearch" />
        </UFormField>
      </div>
    </FilterPanel>

    <UCard class="flex min-h-0 flex-1 flex-col overflow-hidden" :ui="{ body: 'flex h-full flex-col p-0 sm:p-0' }">
      <TableWithPagination
          ref="table"
          :data="data"
          :columns="columns"
          :loading="loading"
          :pagination="pagination"
          :page-size-options="pageSizeOptions"
          compact-mobile
          :mobile-row-actions="rowActions"
      >
        <template #header>
          <TableHeaderOperation
              v-if="tableRef?.tableRef"
              :table-ref="tableRef?.tableRef"
              :loading="loading"
              :selected-count="checkedRowKeys.length"
              compact-mobile
              class="border-b border-gray-200 px-4 py-2 dark:border-gray-800"
              @refresh="refresh"
          >
            <template #prefix>
              <span class="hidden md:inline">{{ $ts('module.system.online.title') }}</span>
            </template>

            <UButton
                v-if="canForceLogout"
                color="error"
                variant="outline"
                icon="i-lucide-log-out"
                :disabled="checkedRowKeys.length === 0"
                :aria-label="$ts('module.system.online.batchForceLogout')"
                :title="$ts('module.system.online.batchForceLogout')"
                @click="batchConfirmOpen = true"
            >
              <span class="hidden md:inline">{{ $ts('module.system.online.batchForceLogout') }}</span>
            </UButton>
          </TableHeaderOperation>
        </template>
      </TableWithPagination>
    </UCard>

    <!-- 批量强退确认 -->
    <UModal
        v-model:open="batchConfirmOpen"
        :title="$ts('module.system.online.batchForceLogout')"
        :ui="{ content: 'max-w-md' }"
    >
      <template #body>
        <p class="text-sm text-muted">
          {{ $ts('module.system.online.batchForceLogoutConfirm', { count: checkedRowKeys.length }) }}
        </p>
      </template>
      <template #footer>
        <UButton color="neutral" variant="subtle" @click="batchConfirmOpen = false">
          {{ $ts('common.cancel') }}
        </UButton>
        <UButton color="error" :loading="batchLoading" @click="handleBatchForceLogout">
          {{ $ts('module.system.online.kick') }}
        </UButton>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysOnlineSessionDto } from '#admin/shared/system/online'
import TableWithPagination from '#admin/app/components/table/TableWithPagination.vue'
import { usePaginatedTable, useSelectionColumn } from '#admin/app/composables/useTable'
import type { MobileRowAction } from '#admin/app/composables/useTable'
import { useToastSuccess } from '#admin/app/utils/toast'

definePageMeta({
  layout: 'system',
  title: '在线用户',
  icon: 'i-lucide-radio'
})

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const { hasPermission } = useRbacProfile()

const tableRef = useTemplateRef('table')
const canForceLogout = computed(() => hasPermission('system:online:forceLogout'))
const onlineFormItemUi = {
  root: 'flex items-center',
  label: 'w-24 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}
const filters = reactive({
  username: '',
  ip: ''
})
const checkedRowKeys = ref<string[]>([])
const batchConfirmOpen = ref(false)
const batchLoading = ref(false)

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '-'
  }

  // MySQL DATETIME 是 "YYYY-MM-DD HH:mm:ss"，Safari 对空格分隔的解析不稳定
  const date = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage
} = usePaginatedTable<SysOnlineSessionDto>({
  query: params => $trpc.sysOnline.page.query({
    ...params,
    username: filters.username.trim() || undefined,
    ip: filters.ip.trim() || undefined
  }),
  pageSizeOptions: [10, 20, 50, 100]
})

const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<SysOnlineSessionDto>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component
})

const handleSearch = async () => {
  checkedRowKeys.value = []
  await getDataByPage(1)
}

const handleReset = async () => {
  filters.username = ''
  filters.ip = ''
  await handleSearch()
}

const forceLogout = async (row: SysOnlineSessionDto) => {
  if (!row.id) {
    return
  }

  await $trpc.sysOnline.forceLogout.mutate({ sessionId: row.id })
  useToastSuccess($ts('module.system.online.forceLogoutSuccess'))
  await refresh()
}

const handleBatchForceLogout = async () => {
  if (checkedRowKeys.value.length === 0) {
    return
  }

  batchLoading.value = true
  try {
    await $trpc.sysOnline.batchForceLogout.mutate(checkedRowKeys.value)
    useToastSuccess($ts('module.system.online.forceLogoutSuccess'))
    checkedRowKeys.value = []
    batchConfirmOpen.value = false
    await refresh()
  } finally {
    batchLoading.value = false
  }
}

/** 移动端行操作：点击「⋯」在按钮下方展示 */
const rowActions = (row: SysOnlineSessionDto): MobileRowAction[] => {
  if (!canForceLogout.value) {
    return []
  }

  return [{
    label: $ts('module.system.online.forceLogout'),
    icon: 'i-lucide-log-out',
    color: 'error',
    confirm: $ts('module.system.online.kickConfirmUser', { user: row.username || '-' }),
    onSelect: () => forceLogout(row)
  }]
}

const columns = computed<TableColumn<SysOnlineSessionDto>[]>(() => {  const actionColumn: TableColumn<SysOnlineSessionDto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      if (!canForceLogout.value) {
        return h('span', { class: 'text-muted' }, '-')
      }

      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')

      return h(Popconfirm, {
        content: $ts('module.system.online.kickConfirmUser', { user: row.original.username || '-' }),
        positiveText: $ts('module.system.online.kick'),
        negativeText: $ts('common.cancel'),
        onConfirm: () => forceLogout(row.original)
      }, {
        trigger: () => h(UButton, {
          size: 'xs',
          variant: 'outline',
          color: 'error',
          icon: 'i-lucide-log-out'
        }, { default: () => $ts('module.system.online.forceLogout') })
      })
    }
  }

  return [
    ...(canForceLogout.value ? [selectionColumn] : []),
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
      header: () => $ts('module.system.online.userName')
    },
    {
      accessorKey: 'ip',
      header: () => $ts('module.system.online.ip')
    },
    {
      accessorKey: 'browser',
      header: () => $ts('module.system.online.browser'),
      cell: ({ row }) => row.original.browser || '-'
    },
    {
      accessorKey: 'os',
      header: () => $ts('module.system.online.os'),
      cell: ({ row }) => row.original.os || '-'
    },
    {
      accessorKey: 'loginAt',
      header: () => $ts('module.system.online.loginAt'),
      cell: ({ row }) => formatDateTime(row.original.loginAt)
    },
    {
      accessorKey: 'lastSeenAt',
      header: () => $ts('module.system.online.lastSeenAt'),
      cell: ({ row }) => formatDateTime(row.original.lastSeenAt)
    },
    actionColumn
  ]
})

let refreshTimer: ReturnType<typeof setInterval> | undefined

onMounted(async () => {
  await search()
  refreshTimer = setInterval(() => {
    if (!loading.value) {
      void refresh()
    }
  }, 10_000)
})

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})
</script>

<style scoped>
@media (max-width: 640px) {
  :deep(table) {
    display: table;
    min-width: 760px;
    width: 100%;
  }
}
</style>
