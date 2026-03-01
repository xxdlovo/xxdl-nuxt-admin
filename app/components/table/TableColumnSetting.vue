<template>
  <UDropdownMenu :items="menuItems" :content="{ align: 'end' }">
    <UButton
        :label="label"
        color="neutral"
        variant="outline"
        trailing-icon="i-lucide-chevron-down"
    />
  </UDropdownMenu>
</template>

<script setup lang="ts">
import type {SysUserDto} from "#shared/system/user/common";
defineOptions({
  name: 'TableColumnSetting'
});
import type {Column, Table} from '@tanstack/vue-table'
const { $ts} = useI18n()
import {computed} from 'vue'


/** UTable 暴露的实例 */
export interface UTableExpose {
  tableApi: Table<any>
}

// 组件 Props
const props = defineProps<{
  /** 表格实例，必须提供 getAllColumns / getColumn 方法 */
  tableRef: UTableExpose | null,
  /** 按钮文本，默认 "Columns" */
  label?: string
}>()

// 获取执行后的标题
function getHeaderLabel(col: Column<any, any>) {
  const header = col.columnDef.header
  if (typeof header === 'function') {
    // @ts-ignore
    return header()
  } else {
    // header 是字符串
    return header
  }
}
// 列文本
const label = computed(() => $ts('common.columnSetting'))

// 列可见性状态（用于触发重新计算）
const visibilityRevision = ref(0)

// 生成 DropdownMenu 菜单项
const menuItems = computed(() => {
  // 依赖 visibilityRevision 以确保列可见性变化时重新计算
  visibilityRevision.value

  if (!props.tableRef) return []
  const tApi = props.tableRef?.tableApi
  if (!tApi) return []

  return tApi
      .getAllColumns()
      .filter((col: Column<any, unknown>) => col.getCanHide())
      .map((col: Column<any, unknown>) => {
        const headerText = getHeaderLabel(col)
        return {
          label: headerText,
          type: 'checkbox' as const,
          checked: col.getIsVisible(),
          onUpdateChecked(checked: boolean) {
            tApi?.getColumn(col.id)?.toggleVisibility(!!checked)
            // 触发重新计算以更新回显
            visibilityRevision.value++
          },
          onSelect(e: Event) {
            e.preventDefault()
          },
        }
      })
})
</script>

