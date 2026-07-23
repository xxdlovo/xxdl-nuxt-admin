<script setup lang="ts">
import type { SysDeptDto, SysDeptQueryDTO } from '#shared/system/department'
import { useToastSuccess } from '~/utils/toast'
import SysDeptSearch from './components/sys-dept-search.vue'
import SysDeptOperate from './components/sys-dept-operate.vue'
import DeptTreeTable, { type DeptTreeNode } from './components/DeptTreeTable.vue'

definePageMeta({
  layout: 'system',
  title: '部门管理',
  icon: 'i-lucide-building-2'
})

type DeptOperateType = 'add' | 'edit'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const deptPermissions = useCrudPermissions('system:dept')
const ROOT_PARENT_ID = '0'
const CHILD_PAGE_SIZE = 100

const loading = ref(false)
const depts = ref<SysDeptDto[]>([])
const searchParams = ref<SysDeptQueryDTO>({})
const loadedChildIds = ref(new Set<string>())
const childLoadingIds = ref(new Set<string>())
const pageSizeOptions = [10, 20, 50, 100]
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})
const drawerVisible = ref(false)
const operateType = ref<DeptOperateType>('add')
const editingData = ref<SysDeptDto | null>(null)
const operateParentId = ref<string | null>(ROOT_PARENT_ID)

const deptTree = computed<DeptTreeNode[]>(() => {
  const map = new Map<string, DeptTreeNode>()
  const roots: DeptTreeNode[] = []

  depts.value.forEach((item) => {
    if (!item.id) {
      return
    }

    map.set(item.id, {
      ...item,
      children: [],
      level: item.level ?? 0
    })
  })

  map.forEach((item) => {
    if (item.parentId && item.parentId !== ROOT_PARENT_ID && map.has(item.parentId)) {
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
  const options: Array<{ label: string, value: string }> = [
    { label: $ts('module.system.department.rootDept'), value: ROOT_PARENT_ID }
  ]

  const walk = (nodes: DeptTreeNode[]) => {
    nodes.forEach((node) => {
      if (node.id) {
        options.push({
          label: `${'  '.repeat(node.level)}${node.name || node.code}`,
          value: node.id
        })
        walk(node.children)
      }
    })
  }

  walk(deptTree.value)
  return options
})

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

const mergeDeptChildren = (children: SysDeptDto[]) => {
  const childIds = new Set(children.map(item => item.id).filter(Boolean))
  depts.value = [
    ...depts.value.filter(item => !item.id || !childIds.has(item.id)),
    ...children
  ]
}

const loadDepts = async () => {
  loading.value = true
  try {
    const result = await $trpc.sysDept.page.query({
      ...searchParams.value,
      page: pagination.page,
      pageSize: pagination.pageSize,
      parentId: ROOT_PARENT_ID
    })
    depts.value = result.list
    loadedChildIds.value = new Set()
    childLoadingIds.value = new Set()
    pagination.page = result.page
    pagination.pageSize = result.pageSize
    pagination.total = result.total
  } finally {
    loading.value = false
  }
}

const loadDeptChildren = async (row: SysDeptDto) => {
  if (!row.id || loadedChildIds.value.has(row.id) || childLoadingIds.value.has(row.id)) {
    return
  }

  setChildLoading(row.id, true)
  try {
    const result = await $trpc.sysDept.page.query({
      page: 1,
      pageSize: CHILD_PAGE_SIZE,
      parentId: row.id
    })
    mergeDeptChildren(result.list)
    setChildLoaded(row.id)
  } finally {
    setChildLoading(row.id, false)
  }
}

const openAdd = (parentId: string | null = ROOT_PARENT_ID) => {
  operateType.value = 'add'
  editingData.value = null
  operateParentId.value = parentId || ROOT_PARENT_ID
  drawerVisible.value = true
}

const openEdit = (row: SysDeptDto) => {
  operateType.value = 'edit'
  editingData.value = row
  operateParentId.value = row.parentId || ROOT_PARENT_ID
  drawerVisible.value = true
}

const handleSearch = async (params: SysDeptQueryDTO) => {
  searchParams.value = params
  pagination.page = 1
  await loadDepts()
}

const handleRemove = async (row: SysDeptDto) => {
  if (!row.id || loading.value) {
    return
  }

  await $trpc.sysDept.remove.mutate(row.id)
  useToastSuccess($ts('common.deleteSuccess'))
  await loadDepts()
}

const handleBatchDelete = async (ids: string[]) => {
  if (loading.value || ids.length === 0) {
    return
  }

  await $trpc.sysDept.batchDelete.mutate(ids)
  useToastSuccess($ts('common.deleteSuccess'))
  await loadDepts()
}

const closeVisible = () => {
  drawerVisible.value = false
}

onMounted(() => {
  loadDepts()
})

watch(
  () => ({ page: pagination.page, pageSize: pagination.pageSize }),
  async (value, oldValue) => {
    if (oldValue && (value.page !== oldValue.page || value.pageSize !== oldValue.pageSize)) {
      await loadDepts()
    }
  }
)
</script>

<template>
  <main class="h-full flex flex-col p-3 gap-3">
    <div class="flex-shrink-0">
      <SysDeptSearch v-model:model="searchParams" @search="handleSearch" />
    </div>

    <UCard class="flex-1 min-h-0 flex flex-col overflow-hidden" :ui="{ body: 'flex flex-col h-full p-0 sm:p-0' }">
      <DeptTreeTable
        :items="deptTree"
        :loading="loading"
        :pagination="pagination"
        :page-size-options="pageSizeOptions"
        :can-add="deptPermissions.canAdd.value"
        :can-edit="deptPermissions.canEdit.value"
        :can-del="deptPermissions.canDel.value"
        :add-permission="deptPermissions.codes.add"
        :delete-permission="deptPermissions.codes.del"
        :loaded-child-ids="loadedChildIds"
        :child-loading-ids="childLoadingIds"
        @add="openAdd(ROOT_PARENT_ID)"
        @add-child="row => openAdd(row.id || ROOT_PARENT_ID)"
        @batch-delete="handleBatchDelete"
        @edit="openEdit"
        @load-children="loadDeptChildren"
        @remove="handleRemove"
        @refresh="loadDepts()"
      />
    </UCard>

    <SysDeptOperate
      v-if="drawerVisible"
      v-model:visible="drawerVisible"
      :operate-type="operateType"
      :data="editingData ?? undefined"
      :parent-id="operateParentId"
      :parent-options="parentOptions"
      :close="closeVisible"
      :refresh="loadDepts"
    />
  </main>
</template>
