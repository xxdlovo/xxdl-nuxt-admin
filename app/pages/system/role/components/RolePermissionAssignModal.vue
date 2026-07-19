<script setup lang="ts">
import type { SysMenuDto } from '#shared/system/menu'
import type { SysRoleDto } from '#shared/system/role'
import { useToastSuccess } from '~/utils/toast'
import RolePermissionTree from './RolePermissionTree.vue'

type AssignType = 'menu' | 'button'

type RolePermissionTreeNode = SysMenuDto & {
  children: RolePermissionTreeNode[]
  level: number
}

const props = defineProps<{
  open: boolean
  role?: SysRoleDto | null
  assignType: AssignType
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const visible = computed({
  get: () => props.open,
  set: value => emit('update:open', value)
})

const loading = ref(false)
const saving = ref(false)
const menus = ref<SysMenuDto[]>([])
const selectedIds = ref<string[]>([])
const expandedIds = ref<string[]>([])

const displayTypes = computed<number[]>(() => props.assignType === 'menu' ? [0, 1] : [0, 1, 2])
const selectableTypes = computed<number[]>(() => props.assignType === 'menu' ? [0, 1] : [2])
const modalTitle = computed(() => props.assignType === 'menu' ? $ts('module.system.role.menuAuth') : $ts('module.system.role.buttonAuth'))

const treeData = computed<RolePermissionTreeNode[]>(() => {
  const map = new Map<string, RolePermissionTreeNode>()
  const roots: RolePermissionTreeNode[] = []

  menus.value.forEach((menu) => {
    if (!menu.id) {
      return
    }

    map.set(menu.id, {
      ...menu,
      children: [],
      level: 0
    })
  })

  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node)
      return
    }

    roots.push(node)
  })

  const sortAndLevel = (nodes: RolePermissionTreeNode[], level = 0) => {
    nodes.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.name || '').localeCompare(String(b.name || '')))
    nodes.forEach((node) => {
      node.level = level
      sortAndLevel(node.children, level + 1)
    })
  }

  const prune = (nodes: RolePermissionTreeNode[]): RolePermissionTreeNode[] => {
    return nodes
      .map(node => ({
        ...node,
        children: prune(node.children)
      }))
      .filter(node => selectableTypes.value.includes(node.type ?? -1) || node.children.length > 0)
  }

  sortAndLevel(roots)
  return prune(roots)
})

const selectableIds = computed(() => {
  return menus.value
    .filter(menu => menu.id && selectableTypes.value.includes(menu.type ?? -1))
    .map(menu => menu.id as string)
})

function getSelectableIds(node: RolePermissionTreeNode): string[] {
  const ids: string[] = []

  if (node.id && selectableTypes.value.includes(node.type ?? -1)) {
    ids.push(node.id)
  }

  node.children.forEach(child => ids.push(...getSelectableIds(child)))
  return ids
}

function getExpandableIds(nodes: RolePermissionTreeNode[]) {
  const ids: string[] = []

  const walk = (items: RolePermissionTreeNode[]) => {
    items.forEach((node) => {
      if (node.id && node.children.length > 0) {
        ids.push(node.id)
      }

      if (node.children.length > 0) {
        walk(node.children)
      }
    })
  }

  walk(nodes)
  return ids
}

function toggleNode(node: RolePermissionTreeNode, checked: boolean) {
  const targetIds = getSelectableIds(node)
  const next = new Set(selectedIds.value)

  targetIds.forEach((id) => {
    if (checked) {
      next.add(id)
    } else {
      next.delete(id)
    }
  })

  selectedIds.value = Array.from(next)
}

function selectAll() {
  selectedIds.value = selectableIds.value
}

function clearSelected() {
  selectedIds.value = []
}

function toggleExpanded(node: RolePermissionTreeNode) {
  if (!node.id) {
    return
  }

  expandedIds.value = expandedIds.value.includes(node.id)
    ? expandedIds.value.filter(id => id !== node.id)
    : [...expandedIds.value, node.id]
}

async function loadData() {
  if (!props.role?.id) {
    return
  }

  loading.value = true
  try {
    const [menuRows, assignedIds] = await Promise.all([
      $trpc.sysRole.assignableMenus.query({ types: displayTypes.value as Array<0 | 1 | 2> }),
      $trpc.sysRole.assignedMenuIds.query({
        roleId: props.role.id,
        types: selectableTypes.value as Array<0 | 1 | 2>
      })
    ])

    menus.value = menuRows
    selectedIds.value = assignedIds
    expandedIds.value = getExpandableIds(treeData.value)
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!props.role?.id) {
    return
  }

  saving.value = true
  try {
    await $trpc.sysRole.assignMenus.mutate({
      roleId: props.role.id,
      menuIds: selectedIds.value,
      types: selectableTypes.value as Array<0 | 1 | 2>
    })
    useToastSuccess($ts('common.modifySuccess'))
    visible.value = false
  } finally {
    saving.value = false
  }
}

watch(
  () => [props.open, props.role?.id, props.assignType] as const,
  ([open]) => {
    if (open) {
      loadData()
    }
  },
  { immediate: true }
)
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="`${modalTitle} - ${role?.name || ''}`"
    :dismissible="!saving"
    :scrollable="false"
    :ui="{ content: 'max-w-[720px] overflow-hidden', body: 'p-4 sm:p-6 overflow-hidden', footer: 'justify-end gap-2 p-4 sm:px-6' }"
  >
    <template #body>
      <div class="flex h-[min(70vh,640px)] min-h-0 flex-col gap-3 overflow-hidden">
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm text-muted">
            {{ $ts('module.system.role.selectedCount', { count: selectedIds.length }) }}
          </p>
          <div class="flex items-center gap-2">
            <UButton :label="$ts('module.system.role.selectAll')" icon="i-lucide-check-check" color="neutral" variant="outline" size="sm" @click="selectAll" />
            <UButton :label="$ts('module.system.role.clearSelection')" icon="i-lucide-eraser" color="neutral" variant="outline" size="sm" @click="clearSelected" />
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto rounded-md border border-default p-2">
          <div v-if="loading" class="flex h-full items-center justify-center gap-2 text-sm text-muted">
            <UIcon name="i-lucide-loader-circle" class="animate-spin" />
            <span>{{ $ts('common.loading') }}</span>
          </div>
          <RolePermissionTree
            v-else-if="treeData.length > 0"
            :nodes="treeData"
            :selected-ids="selectedIds"
            :selectable-types="selectableTypes"
            :expanded-ids="expandedIds"
            @toggle="toggleNode"
            @toggle-expand="toggleExpanded"
          />
          <div v-else class="flex h-full items-center justify-center text-sm text-muted">
            {{ $ts('common.noData') }}
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" :disabled="saving" @click="visible = false" />
      <UButton :label="$ts('common.confirm')" color="primary" :loading="saving" @click="save" />
    </template>
  </UModal>
</template>
