<template>
  <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
    <!-- 表头操作栏 -->
    <slot name="header" />

    <!-- 表格容器 -->
    <div class="flex-1 overflow-auto px-4 min-h-0 relative">
      <!-- Loading 遮罩 -->
      <div
          v-if="loading"
          class="absolute inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-10"
      >
        <div class="flex flex-col items-center gap-3">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-primary animate-spin" />
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ $ts('common.loading') }}</span>
        </div>
      </div>

      <UTable
          ref="tableRef"
          :data="data"
          :columns="columns"
          :loading="loading"
          :ui="ui"
          sticky
          class="min-w-full h-full"
      >
        <template v-for="(_, name) in tableSlots" :key="name" #[name]="slotData">
          <slot :name="name" v-bind="slotData" />
        </template>
      </UTable>
    </div>

    <!-- 分页 -->
    <div class="flex-shrink-0 px-4 py-2 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div class="flex items-center justify-end gap-2">
        <!-- 总数 -->
        <div class="hidden sm:block text-sm text-gray-700 dark:text-gray-300">
          {{ $ts('datatable.itemCount', { total: pagination.total }) }}
        </div>

        <!-- 每页条数选择 -->
        <USelect
            v-model="pagination.pageSize"
            :items="pageSizeOptions"
            :disabled="loading"
            class="w-16 sm:w-20"
        />

        <!-- 分页器 -->
        <UPagination
            v-model:page="pagination.page"
            :items-per-page="pagination.pageSize"
            :total="pagination.total"
            :max="5"
            :disabled="loading"
            show-first
            show-last
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends { id?: string | null }">
import type { TableColumn } from '@nuxt/ui'

interface Pagination {
  page: number
  pageSize: number
  total: number
}

interface Props {
  data: T[]
  columns: TableColumn<T>[]
  loading?: boolean
  pagination: Pagination
  pageSizeOptions?: number[]
  ui?: Record<string, unknown>
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  pageSizeOptions: () => [10, 20, 50, 100]
})

const tableRef = useTemplateRef('tableRef')
const { $ts } = useI18n()
const slots = useSlots()
const tableSlots = computed(() => {
  const { header: _header, ...rest } = slots
  return rest
})

// 暴露 tableRef 给父组件
defineExpose({
  tableRef
})
</script>
