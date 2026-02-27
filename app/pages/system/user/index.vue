<template>
  <UButton @click="test">新增</UButton>
  <SysUserSearch @reset="reset" @search="search"/>
  <UCard class="flex flex-col h-[calc(100vh-200px)]" :ui="{ body: 'flex flex-col h-full p-0' }">
    <TableHeaderOperation
        v-if="table"
        @add="add"
        @batchDelete="batchDelete"
        @refresh="search()"
        :tableRef="table"
        class="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0"
    />

    <!-- 表格容器 - 自动填充剩余空间并支持滚动 -->
    <div class="flex-1 overflow-auto px-4 min-h-0">
      <UTable
          ref="table"
          :data="data"
          :columns="columns"
          sticky
          class="min-w-full h-full"
      />
    </div>

    <!-- 分页 - 固定在底部，移动端适配 -->
    <div class="flex-shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div class="flex items-center justify-end gap-2">
        <!-- 总数 - 在移动端隐藏 -->
        <div class="hidden sm:block text-sm text-gray-700 dark:text-gray-300">
          共 {{ pageInfo.total }} 条
        </div>

        <!-- 每页条数选择 -->
        <USelect
            @change="() => { search() }"
            v-model="pageInfo.pageSize"
            :items="pageSizeItems"
            class="w-16 sm:w-20"
        />

        <!-- 分页器 -->
        <UPagination
            @click="search"
            v-model:page="pageInfo.page"
            :items-per-page="pageInfo.pageSize"
            :total="pageInfo.total"
            :max="5"
            show-first
            show-last
        />
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
const { $trpc } = useNuxtApp()
const table = useTemplateRef('table')
import SysUserSearch from './components/sys-user-search.vue'
import type {SysUserAddDTO, SysUserPageQueryDTO, SysUserQueryDTO} from "#shared/system/user"
import type {SysUserDto} from "#shared/system/user/common"
import {generateMockUsers} from './generateMockUsers'
import SysUserOperate from "./components/sys-user-operate.vue";
import {
  badgeColorRecord,
  enableStatusRecord,
  USER_GENDER_CONFIG,
  USER_STATUS_CONFIG,
  userGenderRecord
} from "#shared/constants/business";
import {useBadgeColumn} from "~/composables/useBadgeColumn";
const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const Popconfirm = resolveComponent('Popconfirm')
const { $ts } = useI18n()
const state = ref<SysUserPageQueryDTO>()
const overlay = useOverlay()
const modal = overlay.create(SysUserOperate)

const pageSizeItems: number[] = [2, 5, 10, 15, 20, 50]
const open =() =>{
  modal.open()
}
const pageInfo = ref({
  page: 1,
  pageSize: 20,
  total: 100
})
const test = async () =>{
  const body:SysUserAddDTO = {
    id:null,
    password: '123456',
    email: '123456',
  username: '1'
  }
  await $trpc.sysUser.create.mutate(body)
}
const columns: TableColumn<SysUserDto>[] = [
  {
    accessorKey: 'id',
    header: '#',
    cell: ({ row }) => `#${row.getValue('id')}`
  },
  {
    accessorKey: 'phone',
    header: () => $ts('module.system.user.userPhone')
  },
  {
    accessorKey: 'password',
    header: '密码'
  },
  {
    accessorKey: 'remark',
    header: '备注'
  },
  useBadgeColumn(
      'gender',
      'module.system.user.userGender',
      USER_GENDER_CONFIG,
      0
  ),
  {
    accessorKey: 'email',
    header: 'Email'
  },
  useBadgeColumn(
      'status',
      'module.system.user.userStatus',
      USER_STATUS_CONFIG,
      1
  ),
  {
    accessorKey: 'actions',
    header: '操作',
    cell: ({ row }) => {
      return h('div', { class: 'flex gap-2' }, [
        h(UButton, {
          variant: 'outline',
          color: 'primary',
          onClick: () => edit(row.original)
        }, { default: () => $ts('common.edit') }),
        h(Popconfirm, {
          onConfirm: () => handleDelete(row.original)
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

const data = ref<SysUserDto[]>([])
const deleteLoading = ref(false)

const search = async (pojo: SysUserQueryDTO = {}) => {
  const clientStart = performance.now()
  const params: SysUserPageQueryDTO = {
    page: pageInfo.value.page,
    pageSize: pageInfo.value.pageSize,
    ...pojo
  }
  const resp = await $trpc.sysUser.page.query(params)
  const clientEnd = performance.now()

  // 记录前端感知的总耗时
  console.log(`[前端] search总耗时: ${(clientEnd - clientStart).toFixed(2)}ms`)

  data.value = resp.list
  pageInfo.value.total = resp.total
}

const reset = () => {
  pageInfo.value.page = 1
  search()
}

const batchDelete = () => {}

// 单行删除
const handleDelete = async (row: SysUserDto) => {
  deleteLoading.value = true
  try {
    await $trpc.sysUser.remove.mutate(row.id as string)
    search()
  } finally {
    deleteLoading.value = false
  }
}

const edit = (row: SysUserDto) => {
  console.log('edit 调用', row)
  modal.open({ operateType: 'edit', data: row, close: () => modal.close(), refresh: search })
}

const add = () => {
  modal.open({ operateType: 'add', close: () => modal.close(), refresh: search })
}
</script>

<style scoped>
/* 确保表格容器正确处理滚动 */
:deep(.overflow-auto) {
  -webkit-overflow-scrolling: touch; /* iOS 平滑滚动 */
}

/* 移动端优化 - 确保表格可以横向滚动 */
@media (max-width: 640px) {
  :deep(table) {
    display: table;
    width: 100%;
    min-width: 600px; /* 根据实际列数调整 */
  }
}
</style>