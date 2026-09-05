<template>
  <div class="flex h-full flex-col gap-3 p-3">
    <UAlert
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      :title="$ts('module.system.storage.notice')"
      :description="bucket === 'memory' ? $ts('module.system.storage.memoryNotice') : $ts('module.system.storage.assetsNotice')"
    />

    <UCard class="flex min-h-0 flex-1 flex-col overflow-hidden" :ui="{ body: 'flex h-full flex-col p-0 sm:p-0' }">
      <div class="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <div class="flex rounded-md border border-gray-200 p-1 dark:border-gray-700">
          <UButton
            v-for="item in bucketItems"
            :key="item.value"
            size="sm"
            :variant="bucket === item.value ? 'solid' : 'ghost'"
            :color="bucket === item.value ? 'primary' : 'neutral'"
            @click="switchBucket(item.value)"
          >
            {{ item.label }}
          </UButton>
        </div>
        <UInput
          v-if="bucket === 'assets'"
          v-model="resourcePath"
          class="w-64"
          :placeholder="$ts('module.system.storage.resourcePathPlaceholder')"
          @keyup.enter="searchByPrefix"
        />
        <UInput v-model="prefix" class="w-56" :placeholder="$ts('module.system.storage.prefixPlaceholder')" @keyup.enter="searchByPrefix" />
        <UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" :loading="loading" @click="refresh">
          {{ $ts('common.refresh') }}
        </UButton>
      </div>

      <TableWithPagination :data="data" :columns="columns" :loading="loading" :pagination="pagination" :page-size-options="pageSizeOptions" />
    </UCard>

    <UModal v-model:open="detailVisible" :title="$ts('module.system.storage.detailTitle')" :ui="{ content: 'max-w-[760px]' }">
      <template #body>
        <div v-if="detail" class="space-y-3 text-sm">
          <dl class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div><dt class="text-gray-500">{{ $ts('module.system.storage.key') }}</dt><dd class="break-all font-mono">{{ detail.key }}</dd></div>
            <div><dt class="text-gray-500">{{ $ts('module.system.storage.type') }}</dt><dd>{{ detail.valueType }}</dd></div>
            <div><dt class="text-gray-500">{{ $ts('module.system.storage.size') }}</dt><dd>{{ formatSize(detail.size) }}</dd></div>
            <div><dt class="text-gray-500">{{ $ts('module.system.storage.updatedAt') }}</dt><dd>{{ formatDate(detail.updatedAt) }}</dd></div>
            <div><dt class="text-gray-500">MIME</dt><dd>{{ detail.mimeType || '-' }}</dd></div>
          </dl>
          <div>
            <div class="mb-1 text-gray-500">{{ $ts('module.system.storage.preview') }}</div>
            <pre class="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs dark:bg-gray-900">{{ detail.preview || $ts('module.system.storage.binaryNotice') }}</pre>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { SysStorageDetail, SysStorageEntry, StorageBucket } from '#shared/system/storage'
import TableWithPagination from '~/components/table/TableWithPagination.vue'
import { usePaginatedTable } from '~/composables/useTable'

definePageMeta({ layout: 'system', title: '存储管理', icon: 'i-lucide-database' })

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const bucket = ref<StorageBucket>('memory')
const prefix = ref('')
// 仅资源桶使用；服务端会再次限制它必须位于 server/storage 目录下。
const resourcePath = ref('server/storage')
const detailVisible = ref(false)
const detail = ref<SysStorageDetail | null>(null)
const storageDeletePermission = 'system:storage:del'
const { hasPermission, isAdmin } = useRbacProfile()
const canDeleteMemory = computed(() => bucket.value === 'memory' && (isAdmin.value || hasPermission(storageDeletePermission)))
// 桶切换使用本地状态驱动查询参数；服务端仍会独立校验 bucket，
// 前端状态不能作为权限或数据边界的唯一保障。
const bucketItems = computed(() => [
  { value: 'memory' as const, label: $ts('module.system.storage.memory') },
  { value: 'assets' as const, label: $ts('module.system.storage.assets') }
])

const { data, loading, pagination, pageSizeOptions, search, refresh, getDataByPage } = usePaginatedTable<SysStorageEntry>({
  // 列表接口只返回元数据，避免首屏加载大段内容；详情在用户点击时按 key 查询。
  query: params => $trpc.sysStorage.list.query({ ...params, bucket: bucket.value, prefix: prefix.value || undefined, resourcePath: bucket.value === 'assets' ? resourcePath.value : undefined }),
  pageSizeOptions: [10, 20, 50, 100]
})

const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString() : '-'

const showDetail = async (row: SysStorageEntry) => {
  // 详情接口同样经过 system:storage:list 权限与服务端 key 校验。
  detail.value = await $trpc.sysStorage.get.query({ bucket: bucket.value, key: row.key, resourcePath: bucket.value === 'assets' ? resourcePath.value : undefined })
  detailVisible.value = true
}

const removeMemory = async (row: SysStorageEntry) => {
  await $trpc.sysStorage.remove.mutate({ bucket: 'memory', key: row.key })
  await refresh()
}

const columns = computed<TableColumn<SysStorageEntry>[]>(() => [
  { accessorKey: 'key', header: () => $ts('module.system.storage.key'), cell: ({ row }) => h('span', { class: 'font-mono text-xs' }, row.original.key) },
  { accessorKey: 'valueType', header: () => $ts('module.system.storage.type') },
  { accessorKey: 'size', header: () => $ts('module.system.storage.size'), cell: ({ row }) => formatSize(row.original.size) },
  { accessorKey: 'updatedAt', header: () => $ts('module.system.storage.updatedAt'), cell: ({ row }) => formatDate(row.original.updatedAt) },
  { id: 'actions', header: () => $ts('common.operate'), cell: ({ row }) => {
    const actions = [h(resolveComponent('UButton'), { size: 'xs', variant: 'outline', icon: 'i-lucide-eye', onClick: () => showDetail(row.original) }, { default: () => $ts('common.detail') })]
    if (canDeleteMemory.value) {
      const Popconfirm = resolveComponent('Popconfirm')
      actions.push(h(Popconfirm, { onConfirm: () => removeMemory(row.original) }, { trigger: () => h(resolveComponent('UButton'), { size: 'xs', color: 'error', variant: 'outline', icon: 'i-lucide-trash-2' }, { default: () => $ts('common.delete') }) }))
    }
    return h('div', { class: 'flex gap-2' }, actions)
  } }
])

const switchBucket = async (value: StorageBucket) => {
  if (bucket.value === value) return
  bucket.value = value
  await getDataByPage(1)
}
const searchByPrefix = async () => getDataByPage(1)

onMounted(() => search())
</script>

<style scoped>
@media (max-width: 640px) {
  :deep(table) { display: table; min-width: 680px; width: 100%; }
}
</style>
