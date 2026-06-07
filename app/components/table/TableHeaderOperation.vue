<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
const {$ts} = useI18n()
defineOptions({
  name: 'TableHeaderOperation'
})

const props = defineProps<{
  tableRef: any | null
  disabledDelete?: boolean
  loading?: boolean
  batchDeleteLoading?: boolean
  selectedCount?: number
}>()

const emit = defineEmits<{
  add: []
  delete: []
  refresh: []
}>()

// 批量删除弹窗状态
const showDeletePopover = ref(false)
const isConfirming = ref(false)

function add() {
  emit('add')
}

async function batchDelete() {
  isConfirming.value = true
  emit('delete')

  // 如果没有 loading，立即关闭
  if (!props.batchDeleteLoading) {
    nextTick(() => {
      showDeletePopover.value = false
      isConfirming.value = false
    })
  }
}

function refresh() {
  emit('refresh')
}

// 处理取消
function handleCancelDelete() {
  showDeletePopover.value = false
  isConfirming.value = false
}

// 监听 batchDeleteLoading 变化，当 loading 完成后关闭对话框
watch(() => props.batchDeleteLoading, (newLoading) => {
  // 当从 loading 变为非 loading，且之前点击了确认时，关闭对话框
  if (!newLoading && isConfirming.value) {
    nextTick(() => {
      showDeletePopover.value = false
      isConfirming.value = false
    })
  }
})
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <!-- prefix slot -->
      <slot name="prefix" />
    </div>

    <div class="flex flex-wrap items-center gap-2">
    <!-- default slot -->
    <slot>
      <!-- 新增 -->
      <UButton
          variant="outline"
          color="primary"
          @click="add"
      >
        <template #leading>
          <UIcon name="i-ic-round-plus" class="w-4 h-4" />
        </template>
       {{ $ts('common.add') }}
      </UButton>

      <!-- 批量删除 -->
      <UPopover v-model:open="showDeletePopover">
        <UButton
            variant="outline"
            color="error"
            :disabled="disabledDelete"
            :loading="batchDeleteLoading"
        >
          <template #leading>
            <UIcon name="i-ic-round-delete" class="w-4 h-4" />
          </template>
          {{ $ts('common.batchDelete') }}
        </UButton>

        <template #content>
          <div class="p-3">
            <p class="text-sm text-gray-600 mb-3">
               {{ $ts('common.confirmDelete', { count: selectedCount || 0 }) }}
              <!-- 确认要删除选中的 <span class="font-semibold text-error">{{ selectedCount || 0 }}</span> 条数据吗？ -->
            </p>

            <div class="flex justify-end gap-2">
              <UButton
                  variant="ghost"
                  color="neutral"
                  @click="handleCancelDelete"
              >
                {{ $ts('common.cancel') }}
              </UButton>

              <UButton
                  color="error"
                  :loading="batchDeleteLoading"
                  @click="batchDelete"
              >
                 {{ $ts('common.confirm') }}
              </UButton>
            </div>
          </div>
        </template>
      </UPopover>
    </slot>

    <!-- 刷新 -->
    <UButton @click="refresh" variant="outline" color="neutral">
      <template #leading>
        <UIcon
            name="i-mdi-refresh"
            class="w-4 h-4"
            :class="{ 'animate-spin': loading }"
        />
      </template>
      {{ $ts('common.refresh') }}
    </UButton>

    <!-- 列设置 -->
<TableColumnSetting :tableRef="tableRef" />
    <!-- suffix slot -->
    <slot name="suffix" />
    </div>
  </div>
</template>


<style scoped></style>
