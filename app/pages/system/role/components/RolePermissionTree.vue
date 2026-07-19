<script setup lang="ts">
import type { SysMenuDto } from '#shared/system/menu'

defineOptions({
  name: 'RolePermissionTree'
})

export type RolePermissionTreeNode = SysMenuDto & {
  children: RolePermissionTreeNode[]
  level: number
}

const props = defineProps<{
  nodes: RolePermissionTreeNode[]
  selectedIds: string[]
  selectableTypes: number[]
  expandedIds: string[]
}>()

const emit = defineEmits<{
  toggle: [node: RolePermissionTreeNode, checked: boolean]
  'toggle-expand': [node: RolePermissionTreeNode]
}>()

const { $ts } = useI18n()
const selectedSet = computed(() => new Set(props.selectedIds))
const expandedSet = computed(() => new Set(props.expandedIds))

function getSelectableIds(node: RolePermissionTreeNode): string[] {
  const ids: string[] = []

  if (node.id && props.selectableTypes.includes(node.type ?? -1)) {
    ids.push(node.id)
  }

  node.children.forEach(child => ids.push(...getSelectableIds(child)))
  return ids
}

function getCheckedState(node: RolePermissionTreeNode) {
  const ids = getSelectableIds(node)

  if (ids.length === 0) {
    return false
  }

  const checkedCount = ids.filter(id => selectedSet.value.has(id)).length
  if (checkedCount === 0) {
    return false
  }
  if (checkedCount === ids.length) {
    return true
  }
  return 'indeterminate'
}

function isDisabled(node: RolePermissionTreeNode) {
  return getSelectableIds(node).length === 0
}

function isExpanded(node: RolePermissionTreeNode) {
  return node.id ? expandedSet.value.has(node.id) : true
}

function typeLabel(type?: number | null) {
  const labels: Record<number, string> = {
    0: $ts('module.system.menu.type.directory'),
    1: $ts('module.system.menu.type.menu'),
    2: $ts('module.system.menu.type.button')
  }

  return type == null ? '-' : labels[type] || '-'
}

function typeColor(type?: number | null) {
  const colors: Record<number, 'neutral' | 'primary' | 'info'> = {
    0: 'neutral',
    1: 'primary',
    2: 'info'
  }

  return type == null ? 'neutral' : colors[type] || 'neutral'
}
</script>

<template>
  <ul class="space-y-1">
    <li v-for="node in nodes" :key="String(node.id || node.code || node.name || node.level)">
      <div
        class="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-elevated/60"
        :style="{ paddingLeft: `${node.level * 18 + 8}px` }"
      >
        <UButton
          v-if="node.children.length > 0"
          :icon="isExpanded(node) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          :aria-label="isExpanded(node) ? $ts('common.collapse') : $ts('common.expand')"
          color="neutral"
          variant="ghost"
          size="xs"
          class="size-6 shrink-0 justify-center p-0"
          @click.stop="emit('toggle-expand', node)"
        />
        <span v-else class="size-6 shrink-0" />
        <UCheckbox
          :model-value="getCheckedState(node)"
          :disabled="isDisabled(node)"
          size="sm"
          @update:model-value="value => emit('toggle', node, Boolean(value))"
        />
        <UIcon v-if="node.icon" :name="node.icon" class="size-4 shrink-0 text-muted" />
        <span class="min-w-0 flex-1 truncate text-default">{{ node.name || node.code }}</span>
        <UBadge :label="typeLabel(node.type)" :color="typeColor(node.type)" variant="soft" size="xs" />
      </div>

      <RolePermissionTree
        v-if="node.children.length > 0 && isExpanded(node)"
        :nodes="node.children"
        :selected-ids="selectedIds"
        :selectable-types="selectableTypes"
        :expanded-ids="expandedIds"
        @toggle="(child, checked) => emit('toggle', child, checked)"
        @toggle-expand="node => emit('toggle-expand', node)"
      />
    </li>
  </ul>
</template>
