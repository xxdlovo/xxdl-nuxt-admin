<script setup lang="ts">
import type { GenFileTreeNode } from '#admin/app/utils/gen'

defineOptions({ name: 'GenFileTreeNode' })

const props = withDefaults(defineProps<{
  node: GenFileTreeNode
  depth?: number
  selectedPath?: string
}>(), {
  depth: 0,
  selectedPath: '',
})

const emit = defineEmits<{
  select: [path: string]
}>()

// 默认展开全部目录，方便一进来就看到完整结构
const open = ref(true)
const isFolder = computed(() => Boolean(props.node.children))
const isSelected = computed(() => !isFolder.value && props.node.path === props.selectedPath)

function toggle() {
  if (isFolder.value) {
    open.value = !open.value
    return
  }

  if (props.node.path) {
    emit('select', props.node.path)
  }
}
</script>

<template>
  <div>
    <button
        type="button"
        class="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-900"
        :class="isSelected ? 'bg-gray-100 font-medium text-primary dark:bg-gray-900' : 'text-default'"
        :style="{ paddingLeft: `${depth * 12 + 8}px` }"
        :title="node.path || node.label"
        @click="toggle"
    >
      <UIcon
          v-if="isFolder"
          :name="open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          class="size-3 shrink-0 text-muted"
      />
      <UIcon
          :name="isFolder ? (open ? 'i-lucide-folder-open' : 'i-lucide-folder') : (node.icon || 'i-lucide-file')"
          class="size-3.5 shrink-0"
          :class="isFolder ? 'text-amber-500' : 'text-muted'"
      />
      <span class="truncate">{{ node.label }}</span>
    </button>

    <div v-if="isFolder && open">
      <GenFileTreeNode
          v-for="child in node.children"
          :key="child.id"
          :node="child"
          :depth="depth + 1"
          :selected-path="selectedPath"
          @select="emit('select', $event)"
      />
    </div>
  </div>
</template>
