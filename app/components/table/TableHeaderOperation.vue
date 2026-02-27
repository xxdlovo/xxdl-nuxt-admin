<script setup lang="ts">


defineOptions({
  name: 'TableHeaderOperation'
});


defineProps<{
  tableRef: any | null,
  itemAlign?: string;
  disabledDelete?: boolean;
  loading?: boolean;
}>();



const emit = defineEmits<{
  'add': [];
  'delete': [];
  'refresh': [];
}>();

const columns = defineModel<any[]>('columns', {
  default: () => []
});

function add() {
  emit('add');
}

function batchDelete() {
  emit('delete');
}

function refresh() {
  emit('refresh');
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-end">


    <!-- prefix slot -->
    <slot name="prefix" />

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
        新增
      </UButton>

      <!-- 批量删除 -->
      <UPopover>
        <UButton
            variant="outline"
            color="error"
            :disabled="disabledDelete"
        >
          <template #leading>
            <UIcon name="i-ic-round-delete" class="w-4 h-4" />
          </template>
          批量删除
        </UButton>

        <template #content>
          <div class="p-3 space-y-2">
            <p class="text-sm text-gray-600">
              确认要删除选中的数据吗？
            </p>

            <div class="flex justify-end gap-2">
              <UButton
                  variant="ghost"
                  color="warning"
              >
                取消
              </UButton>

              <UButton
                  color="warning"
                  @click="batchDelete"
              >
                确认删除
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
      刷新
    </UButton>

    <!-- 列设置 -->
<TableColumnSetting :tableRef="tableRef" />
    <!-- suffix slot -->
    <slot name="suffix" />
  </div>
</template>


<style scoped></style>
