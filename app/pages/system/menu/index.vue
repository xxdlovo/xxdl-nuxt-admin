<script setup lang="ts">
import type { SysMenuDto } from '#shared/system/menu'
import { useToastSuccess } from '~/utils/toast'
import MenuOperateModal from './components/MenuOperateModal.vue'
import MenuTreeTable from './components/MenuTreeTable.vue'
import type { MenuOpenPayload, MenuTreeNode } from '#shared/system/menu'

definePageMeta({
  layout: 'system'
})

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const menuPermissions = useCrudPermissions('system:menu')
const ROOT_PARENT_ID = '0'
const CHILD_PAGE_SIZE = 100

const loading = ref(false)
const menus = ref<SysMenuDto[]>([])
const loadedChildIds = ref(new Set<string>())
const childLoadingIds = ref(new Set<string>())
const pageSizeOptions = [10, 20, 50, 100]
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})
const operateVisible = ref(false)
const operateType = ref<MenuOpenPayload['type']>('add')
const operateData = ref<SysMenuDto | null>(null)
const operateParentId = ref<string | null>(null)
const operateDefaultType = ref<number>(2)

const menuTree = computed<MenuTreeNode[]>(() => {
  const map = new Map<string, MenuTreeNode>()
  const roots: MenuTreeNode[] = []

  menus.value.forEach((item) => {
    if (!item.id || item.type === 2) {
      return
    }
    map.set(item.id, { ...item, children: [], level: 0 })
  })

  map.forEach((item) => {
    if (item.parentId && map.has(item.parentId)) {
      const parent = map.get(item.parentId)!
      item.level = parent.level + 1
      parent.children.push(item)
      return
    }
    roots.push(item)
  })

  return roots
})

const parentOptions = computed(() => {
  const options: Array<{ label: string, value: string }> = []

  const walk = (nodes: MenuTreeNode[]) => {
    nodes.forEach((node) => {
      // Button records are leaf permission points and should not become parents.
      if (node.id && node.type !== 2) {
        options.push({
          label: `${'  '.repeat(node.level)}${node.name || node.code}`,
          value: node.id
        })
        walk(node.children)
      }
    })
  }

  walk(menuTree.value)
  return options
})

const loadMenus = async () => {
  loading.value = true
  try {
    const result = await $trpc.sysMenu.page.query({
      page: pagination.page,
      pageSize: pagination.pageSize,
      parentId: ROOT_PARENT_ID
    })
    menus.value = result.list
    loadedChildIds.value = new Set()
    childLoadingIds.value = new Set()
    pagination.page = result.page
    pagination.pageSize = result.pageSize
    pagination.total = result.total
  } finally {
    loading.value = false
  }
}

const setChildLoading = (id: string, loadingValue: boolean) => {
  const ids = new Set(childLoadingIds.value)
  if (loadingValue) {
    ids.add(id)
  } else {
    ids.delete(id)
  }
  childLoadingIds.value = ids
}

const setChildLoaded = (id: string) => {
  loadedChildIds.value = new Set([...loadedChildIds.value, id])
}

const mergeMenuChildren = (children: SysMenuDto[]) => {
  const childIds = new Set(children.map(item => item.id).filter(Boolean))
  menus.value = [
    ...menus.value.filter(item => !item.id || !childIds.has(item.id)),
    ...children
  ]
}

const loadMenuChildren = async (row: SysMenuDto) => {
  if (!row.id || loadedChildIds.value.has(row.id) || childLoadingIds.value.has(row.id)) {
    return
  }

  setChildLoading(row.id, true)
  try {
    const result = await $trpc.sysMenu.page.query({
      page: 1,
      pageSize: CHILD_PAGE_SIZE,
      parentId: row.id
    })
    mergeMenuChildren(result.list)
    setChildLoaded(row.id)
  } finally {
    setChildLoading(row.id, false)
  }
}

const openOperate = async (payload: MenuOpenPayload) => {
  if (payload.type === 'edit' && payload.row?.id && payload.row.type === 1) {
    await loadMenuChildren(payload.row)
  }

  operateType.value = payload.type
  operateData.value = payload.row || null
  operateParentId.value = payload.parentId ?? payload.row?.parentId ?? null
  operateDefaultType.value = payload.menuType ?? payload.row?.type ?? 1
  operateVisible.value = true
}

const handleRemove = async (row: SysMenuDto) => {
  if (!row.id) {
    return
  }

  await $trpc.sysMenu.remove.mutate(row.id)
  useToastSuccess($ts('common.deleteSuccess'))
  await loadMenus()
}

const handleBatchDelete = async (ids: string[]) => {
  if (ids.length === 0) {
    return
  }

  await $trpc.sysMenu.batchDelete.mutate(ids)
  useToastSuccess($ts('common.deleteSuccess'))
  await loadMenus()
}

onMounted(() => {
  loadMenus()
})

watch(
  () => ({ page: pagination.page, pageSize: pagination.pageSize }),
  async (value, oldValue) => {
    if (oldValue && (value.page !== oldValue.page || value.pageSize !== oldValue.pageSize)) {
      await loadMenus()
    }
  }
)
</script>

<template>
  <main class="h-full flex flex-col p-3 gap-3">
    <UCard class="flex-1 min-h-0 flex flex-col overflow-hidden" :ui="{ body: 'flex flex-col h-full p-0 sm:p-0' }">
      <MenuTreeTable
        :items="menuTree"
        :loading="loading"
        :pagination="pagination"
        :page-size-options="pageSizeOptions"
        :can-add="menuPermissions.canAdd.value"
        :can-edit="menuPermissions.canEdit.value"
        :can-del="menuPermissions.canDel.value"
        :add-permission="menuPermissions.codes.add"
        :delete-permission="menuPermissions.codes.del"
        :loaded-child-ids="loadedChildIds"
        :child-loading-ids="childLoadingIds"
        @add="openOperate({ type: 'add', parentId: ROOT_PARENT_ID, menuType: 0 })"
        @add-child="row => openOperate({ type: 'add', parentId: row.id, menuType: 1 })"
        @batch-delete="handleBatchDelete"
        @edit="row => openOperate({ type: 'edit', row })"
        @load-children="loadMenuChildren"
        @remove="handleRemove"
        @refresh="loadMenus()"
      />
    </UCard>

    <MenuOperateModal
      v-if="operateVisible"
      v-model:open="operateVisible"
      :operate-type="operateType"
      :data="operateData"
      :parent-id="operateParentId"
      :default-type="operateDefaultType"
      :parent-options="parentOptions"
      :all-menus="menus"
      @saved="loadMenus()"
    />
  </main>
</template>
