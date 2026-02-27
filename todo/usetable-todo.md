# Nuxt UI Table Hooks 封装计划

> 参考 soybean-admin 的 `useNaivePaginatedTable` 和 `useTableOperate`，为 Nuxt 4 + Nuxt UI + tRPC 项目创建类似的表格 hooks 封装

## 设计目标

- ✅ 统一表格数据查询、分页、loading 管理
- ✅ 统一 CRUD 操作（新增、编辑、删除）
- ✅ 支持列配置动态管理（国际化）
- ✅ 类型安全（利用 tRPC 类型推断）
- ✅ 代码复用，减少重复代码

## 核心设计对比

### soybean-admin (Naive UI)
```ts
const { columns, data, loading, getData, pagination } = useNaivePaginatedTable({
  api: () => fetchGetUserList(searchParams),
  transform: response => defaultTransform(response),
  onPaginationParamsChange: params => { ... },
  columns: () => [...]
})

const { drawerVisible, operateType, editingData, handleAdd, handleEdit } = useTableOperate(data, 'id', getData)
```

### 目标设计 (Nuxt UI)
```ts
const { columns, data, loading, search, pagination } = usePaginatedTable({
  query: (params) => $trpc.sysUser.page.query(params),
  columns: () => [...]
})

const { modal, operateType, editingData, handleAdd, handleEdit } = useTableOperate({
  data,
  idKey: 'id',
  refresh: search
})
```

## 实现计划

### Phase 1: 基础类型定义

**文件**: `app/composables/useTable/types.ts`

```ts
// 分页参数
export interface PaginationParams {
  page: number
  pageSize: number
}

// 分页响应数据
export interface PaginatedData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// 表格操作类型
export type OperateType = 'add' | 'edit'

// 列配置检查
export interface ColumnCheck {
  key: string
  title: string
  checked: boolean
  visible: boolean
}

// useTable 配置项
export interface UseTableOptions<T> {
  query: (params: PaginationParams & Record<string, any>) => Promise<PaginatedData<T>>
  searchParams?: Ref<Record<string, any>>
  columns: () => TableColumn<T>[]
  onFetched?: (data: PaginatedData<T>) => void
}
```

### Phase 2: 基础 Table Hook

**文件**: `app/composables/useTable/useTable.ts`

```ts
export function useTable<T>(options: UseTableOptions<T>) {
  const data = ref<T[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)

  // 列配置（支持国际化动态更新）
  const columns = ref<TableColumn<T>[]>(options.columns())

  // 重新加载列（用于语言切换时更新）
  const reloadColumns = () => {
    columns.value = options.columns()
  }

  // 获取数据
  const getData = async (params?: Record<string, any>) => {
    loading.value = true
    error.value = null

    try {
      const paginationParams: PaginationParams = {
        page: options.searchParams?.value.page || 1,
        pageSize: options.searchParams?.value.pageSize || 20
      }

      const result = await options.query({
        ...paginationParams,
        ...options.searchParams?.value,
        ...params
      })

      data.value = result.list
      options.onFetched?.(result)

      return result
    } catch (err) {
      error.value = err as Error
      throw err
    } finally {
      loading.value = false
    }
  }

  // 监听国际化变化，重新加载列
  const { $i18n } = useNuxtApp()
  watch(() => $i18n.locale, reloadColumns)

  return {
    data,
    loading,
    error,
    columns,
    reloadColumns,
    getData
  }
}
```

### Phase 3: 分页 Table Hook

**文件**: `app/composables/useTable/usePaginatedTable.ts`

```ts
export function usePaginatedTable<T>(options: UsePaginatedTableOptions<T>) {
  // 分页信息
  const pagination = reactive({
    page: 1,
    pageSize: 20,
    total: 0
  })

  // 基础 table hook
  const table = useTable<T>({
    ...options,
    onFetched: (data) => {
      pagination.page = data.page
      pagination.pageSize = data.pageSize
      pagination.total = data.total
      options.onFetched?.(data)
    }
  })

  // 搜索/查询方法
  const search = async (params?: Record<string, any>) => {
    await table.getData(params)
  }

  // 切换页码
  const changePage = (page: number) => {
    pagination.page = page
    search()
  }

  // 切换每页条数
  const changePageSize = (pageSize: number) => {
    pagination.pageSize = pageSize
    pagination.page = 1
    search()
  }

  // 刷新
  const refresh = () => {
    search()
  }

  return {
    ...table,
    pagination,
    search,
    changePage,
    changePageSize,
    refresh
  }
}
```

### Phase 4: Table 操作 Hook

**文件**: `app/composables/useTable/useTableOperate.ts`

```ts
export interface UseTableOperateOptions<T> {
  data: Ref<T[]>
  idKey: keyof T
  refresh: () => void | Promise<void>
}

export function useTableOperate<T>(options: UseTableOperateOptions<T>) {
  const { $ts } = useI18n()
  const overlay = useOverlay()

  // 操作类型
  const operateType = ref<OperateType>('add')

  // 编辑中的数据
  const editingData = ref<T | null>(null)

  // 创建模态框（需要传入组件）
  const createModal = <Comp extends Component>(
    component: Comp
  ) => {
    return overlay.create(component)
  }

  // 新增
  const handleAdd = () => {
    operateType.value = 'add'
    editingData.value = null
    return { operateType, editingData }
  }

  // 编辑
  const handleEdit = (id: T[keyof T]) => {
    operateType.value = 'edit'
    const item = options.data.value.find(item => item[options.idKey] === id)
    editingData.value = item ? { ...item } : null
    return { operateType, editingData }
  }

  // 删除
  const handleDelete = async (id: T[keyof T], deleteApi: (id: string) => Promise<void>) => {
    await deleteApi(id as string)
    useToastSuccess($ts('common.deleteSuccess'))
    await options.refresh()
  }

  // 批量删除
  const handleBatchDelete = async (
    ids: T[keyof T][],
    deleteApi: (ids: string[]) => Promise<void>
  ) => {
    await deleteApi(ids as string[])
    useToastSuccess($ts('common.deleteSuccess'))
    await options.refresh()
  }

  return {
    operateType,
    editingData,
    handleAdd,
    handleEdit,
    handleDelete,
    handleBatchDelete,
    createModal
  }
}
```

### Phase 5: 列配置辅助函数

**文件**: `app/composables/useTable/helpers.ts`

```ts
// Badge 列配置（保留现有 useBadgeColumn）
export function useBadgeColumn<T>(...)

// 操作列配置工厂
export function useActionsColumn<T>(
  actions: ActionConfig<T>[]
): TableColumn<T> {
  return {
    accessorKey: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      return h('div', { class: 'flex gap-2' },
        actions.map(action => action.render(row.original))
      )
    }
  }
}

// 操作配置
export interface ActionConfig<T> {
  type: 'edit' | 'delete' | 'custom'
  onClick: (row: T) => void
  render?: (row: T) => VNode
}
```

### Phase 6: 实际使用示例

**文件**: `app/pages/system/user/index.vue` (重构后)

```vue
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import SysUserSearch from './components/sys-user-search.vue'
import SysUserOperate from './components/sys-user-operate.vue'
import { useBadgeColumn, useActionsColumn } from '~/composables/useTable'
import { USER_GENDER_CONFIG, USER_STATUS_CONFIG } from '#shared/constants/business'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

// 搜索参数
const searchParams = ref({
  userName: null,
  userGender: null,
  status: null
})

// 表格 hook
const {
  data,
  loading,
  columns,
  search,
  pagination,
  refresh
} = usePaginatedTable({
  query: (params) => $trpc.sysUser.page.query(params),
  searchParams,
  columns: () => [
    {
      accessorKey: 'id',
      header: '#',
      cell: ({ row }) => `#${row.getValue('id')}`
    },
    {
      accessorKey: 'username',
      header: () => $ts('module.system.user.userName')
    },
    useBadgeColumn('gender', 'module.system.user.userGender', USER_GENDER_CONFIG, 0),
    useBadgeColumn('status', 'module.system.user.userStatus', USER_STATUS_CONFIG, 1),
    // 操作列
    {
      accessorKey: 'actions',
      header: () => $ts('common.operate'),
      cell: ({ row }) => {
        const UButton = resolveComponent('UButton')
        const Popconfirm = resolveComponent('Popconfirm')

        return h('div', { class: 'flex gap-2' }, [
          h(UButton, {
            variant: 'outline',
            color: 'primary',
            onClick: () => tableOperate.handleEdit(row.original.id)
          }, { default: () => $ts('common.edit') }),

          h(Popconfirm, {
            onConfirm: () => tableOperate.handleDelete(
              row.original.id,
              (id) => $trpc.sysUser.remove.mutate(id)
            )
          }, {
            trigger: () => h(UButton, {
              variant: 'outline',
              color: 'error'
            }, { default: () => $ts('common.delete') })
          })
        ])
      }
    }
  ]
})

// 表格操作 hook
const tableOperate = useTableOperate({
  data,
  idKey: 'id',
  refresh
})

// 模态框
const modal = overlay.create(SysUserOperate)

// 打开新增
const openAdd = () => {
  const { operateType, editingData } = tableOperate.handleAdd()
  modal.open({
    operateType: operateType.value,
    data: editingData.value,
    close: () => modal.close(),
    refresh
  })
}

// 打开编辑
const openEdit = (id: string) => {
  const { operateType, editingData } = tableOperate.handleEdit(id)
  modal.open({
    operateType: operateType.value,
    data: editingData.value,
    close: () => modal.close(),
    refresh
  })
}

// 搜索
const handleSearch = (params: any) => {
  searchParams.value = { ...searchParams.value, ...params }
  search()
}

// 重置
const handleReset = () => {
  searchParams.value = {
    userName: null,
    userGender: null,
    status: null
  }
  pagination.page = 1
  search()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <SysUserSearch
      v-model:model="searchParams"
      @search="handleSearch"
      @reset="handleReset"
    />

    <UCard class="flex flex-col h-[calc(100vh-200px)]">
      <TableHeaderOperation
        @add="openAdd"
        @refresh="refresh"
        :loading="loading"
      />

      <UTable
        :data="data"
        :columns="columns"
        :loading="loading"
        sticky
      />

      <div class="flex items-center justify-end gap-2 p-4 border-t">
        <span>共 {{ pagination.total }} 条</span>
        <USelect
          v-model="pagination.pageSize"
          :items="[10, 20, 50, 100]"
          @change="() => changePageSize(pagination.pageSize)"
        />
        <UPagination
          v-model:page="pagination.page"
          :items-per-page="pagination.pageSize"
          :total="pagination.total"
          @click="() => changePage(pagination.page)"
        />
      </div>
    </UCard>
  </div>
</template>
```

## 文件结构

```
app/composables/useTable/
├── index.ts              # 导出所有 hooks
├── types.ts              # 类型定义
├── useTable.ts           # 基础表格 hook
├── usePaginatedTable.ts  # 分页表格 hook
├── useTableOperate.ts    # 表格操作 hook
└── helpers.ts            # 辅助函数（useBadgeColumn 等）
```

## 优势对比

### 当前实现 (index.vue)
- ❌ 约 200+ 行代码
- ❌ 分页、查询、操作逻辑混杂
- ❌ 状态管理分散
- ❌ 难以复用

### 封装后
- ✅ 约 80 行代码
- ✅ 逻辑清晰，职责分离
- ✅ hooks 可复用
- ✅ 易于测试和维护

## 实施步骤

1. ✅ 创建类型定义 (`types.ts`)
2. ✅ 实现 `useTable` 基础 hook
3. ✅ 实现 `usePaginatedTable` 分页 hook
4. ✅ 实现 `useTableOperate` 操作 hook
5. ✅ 迁移 `useBadgeColumn` 到 `helpers.ts`
6. ✅ 重构 `app/pages/system/user/index.vue`
7. ✅ 测试功能完整性
8. ✅ 应用到其他模块（role, department 等）

## 待讨论问题

1. **搜索参数管理**
   - 当前使用 `ref` 管理搜索参数
   - 是否需要单独的 `useSearchParams` hook？
   - 建议:自动处理, 哪个方便/快捷用那个

2. **错误处理**
   - 是否需要在 hook 中统一错误处理？
   - 还是让使用者自行处理？
   - 建议:自行处理

3. **表单操作组件**
   - 当前使用 `useOverlay` + `overlay.create()`
   - 是否需要封装成 `useTableForm`？
   - 建议:不需要单独封装

4. **列配置持久化**
   - 是否需要保存用户的列显示/隐藏配置？
   - 使用 localStorage 还是后端存储？
   - 建议:暂时不需要, 加TODO后续实现
