<script setup lang="ts">
import type { SysDeptDto } from '#shared/system/department'

export type DeptTreeItem = {
  id: string
  label: string
  icon?: string
  dept?: SysDeptDto
  children?: DeptTreeItem[]
  defaultExpanded?: boolean
}

const props = withDefaults(defineProps<{
  keyword?: string
}>(), {
  keyword: ''
})

const emit = defineEmits<{
  select: [item: DeptTreeItem]
}>()

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const ALL_DEPT_ID = '__all__'

const selectedId = defineModel<string | null>('selectedId', { default: null })
const loading = ref(false)
const depts = ref<SysDeptDto[]>([])

const buildDeptTree = (rows: SysDeptDto[]) => {
  const map = new Map<string, DeptTreeItem>()
  const roots: DeptTreeItem[] = []

  rows
    .filter(item => Boolean(item.id))
    .forEach((item) => {
      map.set(item.id as string, {
        id: item.id as string,
        label: item.name || item.code || item.id || '',
        icon: 'i-lucide-building-2',
        dept: item,
        children: []
      })
    })

  map.forEach((node) => {
    const parentId = node.dept?.parentId
    if (parentId && parentId !== '0' && map.has(parentId)) {
      map.get(parentId)!.children!.push(node)
      return
    }

    roots.push(node)
  })

  const sortTree = (items: DeptTreeItem[]) => {
    items.sort((a, b) => (a.dept?.sortOrder ?? 0) - (b.dept?.sortOrder ?? 0) || a.label.localeCompare(b.label))
    items.forEach(item => sortTree(item.children || []))
  }

  sortTree(roots)
  return roots
}

const filterDeptTree = (items: DeptTreeItem[], keyword: string): DeptTreeItem[] => {
  const query = keyword.trim().toLowerCase()
  if (!query) {
    return items
  }

  return items
    .map((item) => {
      const children = filterDeptTree(item.children || [], query)
      const matched = item.label.toLowerCase().includes(query) || String(item.dept?.code || '').toLowerCase().includes(query)
      if (!matched && children.length === 0) {
        return null
      }

      return {
        ...item,
        children,
        defaultExpanded: true
      }
    })
    .filter(Boolean) as DeptTreeItem[]
}

const deptTreeItems = computed<DeptTreeItem[]>(() => [
  {
    id: ALL_DEPT_ID,
    label: '全部部门',
    icon: 'i-lucide-network',
    defaultExpanded: true,
    children: filterDeptTree(buildDeptTree(depts.value), props.keyword)
  }
])

const findDeptTreeItem = (items: DeptTreeItem[], id: string): DeptTreeItem | undefined => {
  for (const item of items) {
    if (item.id === id) {
      return item
    }

    const child = findDeptTreeItem(item.children || [], id)
    if (child) {
      return child
    }
  }
}

const selectedTreeKey = computed(() => selectedId.value || ALL_DEPT_ID)
const selectedDeptItem = computed(() => findDeptTreeItem(deptTreeItems.value, selectedTreeKey.value) || deptTreeItems.value[0])

const loadDepts = async () => {
  loading.value = true
  try {
    depts.value = await $trpc.sysDept.list.query({})
  } finally {
    loading.value = false
  }
}

const selectDept = (item?: DeptTreeItem) => {
  const nextItem = item || deptTreeItems.value[0]
  if (!nextItem) {
    return
  }

  selectedId.value = nextItem.id === ALL_DEPT_ID ? null : nextItem.id
  emit('select', nextItem)
}

onMounted(loadDepts)

defineExpose({
  refresh: loadDepts
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
    <div class="flex items-center justify-between gap-2 border-b border-default px-3 py-2">
      <div class="flex min-w-0 items-center gap-2">
        <UIcon name="i-lucide-building-2" class="size-4 text-muted" />
        <span class="truncate text-sm font-medium">{{ $ts('module.system.department.title') }}</span>
      </div>
      <UButton
        icon="i-lucide-refresh-cw"
        size="xs"
        color="neutral"
        variant="ghost"
        square
        :loading="loading"
        @click="loadDepts"
      />
    </div>

    <div v-if="loading" class="space-y-2 p-3">
      <div v-for="(width, idx) in [150, 90, 90]" :key="idx" class="flex items-center gap-4" :class="{ 'px-9': idx > 0 }">
        <USkeleton class="size-6 rounded-full" />
        <div class="grid gap-2">
          <USkeleton class="h-4" :class="[`w-[${width}px]`]" />
        </div>
      </div>
    </div>
    <UScrollArea v-else class="min-h-0 flex-1 p-2">
      <UTree
        :items="deptTreeItems"
        :model-value="selectedDeptItem"
        :get-key="item => item.id"
        :default-expanded="[ALL_DEPT_ID]"
        color="primary"
        size="sm"
        @update:model-value="selectDept"
      >
        <template #item-wrapper="{ item, selected, expanded, handleSelect, handleToggle, ui }">
          <div :class="ui.link({ selected })" @click.stop>
            <UButton
              v-if="item.children?.length"
              :icon="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              size="xs"
              color="neutral"
              variant="ghost"
              square
              class="-ml-1 shrink-0"
              @click.stop="handleToggle"
            />
            <span v-else class="size-6 shrink-0" />

            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-2 text-left"
              @click.stop="handleSelect"
            >
              <UIcon :name="item.icon || 'i-lucide-building-2'" class="size-4 shrink-0 text-muted" />
              <span class="truncate">{{ item.label }}</span>
            </button>
          </div>
        </template>
      </UTree>
    </UScrollArea>
  </div>
</template>
