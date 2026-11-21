<template>
  <div class="flex h-full flex-col gap-3 p-3">
    <FilterPanel
      storage-key="sys-gen-search-fab-pos"
      @search="handleSearch"
      @reset="handleReset"
    >
      <div class="grid grid-cols-1 gap-4 px-2 pb-1 sm:grid-cols-2">
        <UFormField :label="$ts('module.system.gen.searchTableName')" orientation="horizontal" :ui="genFormItemUi">
          <UInput v-model="filters.tableName" :placeholder="$ts('module.system.gen.searchTableName')" icon="i-lucide-table" class="w-full" @keyup.enter="handleSearch" />
        </UFormField>
        <UFormField :label="$ts('module.system.gen.searchTableComment')" orientation="horizontal" :ui="genFormItemUi">
          <UInput v-model="filters.tableComment" :placeholder="$ts('module.system.gen.searchTableComment')" icon="i-lucide-message-square" class="w-full" @keyup.enter="handleSearch" />
        </UFormField>
      </div>
    </FilterPanel>

    <UCard class="flex min-h-0 flex-1 flex-col overflow-hidden" :ui="{ body: 'flex h-full flex-col p-0 sm:p-0' }">
      <TableWithPagination
          ref="table"
          :data="data"
          :columns="columns"
          :loading="loading"
          :pagination="pagination"
          :page-size-options="pageSizeOptions"
          compact-mobile
          :mobile-row-actions="rowActions"
      >
        <template #header>
          <TableHeaderOperation
              v-if="tableRef?.tableRef"
              :table-ref="tableRef?.tableRef"
              :loading="loading"
              compact-mobile
              class="border-b border-gray-200 px-4 py-2 dark:border-gray-800"
              @refresh="refresh"
          >
            <template #prefix>
              <span class="hidden md:inline">{{ $ts('module.system.gen.title') }}</span>
            </template>
            <template #default>
              <UButton
                  v-if="hasPermission('system:gen:import')"
                  color="primary"
                  variant="outline"
                  icon="i-lucide-database"
                  :aria-label="$ts('module.system.gen.importTables')"
                  :title="$ts('module.system.gen.importTables')"
                  @click="openImport"
              >
                <span class="hidden md:inline">{{ $ts('module.system.gen.importTables') }}</span>
              </UButton>
              <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-bot"
                  :aria-label="$ts('module.system.gen.ai.access')"
                  :title="$ts('module.system.gen.ai.access')"
                  @click="aiVisible = true"
              >
                <span class="hidden md:inline">{{ $ts('module.system.gen.ai.access') }}</span>
              </UButton>
            </template>
          </TableHeaderOperation>
        </template>
      </TableWithPagination>
    </UCard>

    <!-- 导入数据库表 -->
    <UModal
        v-model:open="importVisible"
        :title="$ts('module.system.gen.importTables')"
        :dismissible="!importing"
        :ui="{ content: 'max-w-2xl overflow-hidden' }"
    >
      <template #body>
        <div class="space-y-3">
          <UInput v-model="dbKeyword" icon="i-lucide-search" :placeholder="$ts('module.system.gen.searchTableName')" />
          <div class="max-h-80 overflow-auto rounded-md border border-gray-200 dark:border-gray-800">
            <label
                v-for="item in filteredDbTables"
                :key="item.tableName"
                class="flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
            >
              <UCheckbox
                  :model-value="selectedTables.includes(item.tableName)"
                  :disabled="item.imported"
                  @update:model-value="toggleTable(item.tableName, $event)"
              />
              <span class="font-mono text-sm">{{ item.tableName }}</span>
              <span class="truncate text-xs text-muted">{{ item.tableComment }}</span>
              <UBadge v-if="item.imported" color="neutral" size="sm">{{ $ts('module.system.gen.imported') }}</UBadge>
            </label>
            <div v-if="filteredDbTables.length === 0" class="p-6 text-center text-sm text-muted">
              {{ $ts('common.noData') }}
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" :disabled="importing" @click="importVisible = false" />
        <UButton
            :label="$ts('module.system.gen.import')"
            color="primary"
            :loading="importing"
            :disabled="selectedTables.length === 0"
            @click="handleImport"
        />
      </template>
    </UModal>

    <!-- AI 接入说明 -->
    <UModal
        v-model:open="aiVisible"
        :title="$ts('module.system.gen.ai.title')"
        :ui="{ content: 'w-[calc(100vw-2rem)] max-w-3xl overflow-hidden', body: 'max-h-[70vh] overflow-auto p-4 sm:p-6' }"
    >
      <template #body>
        <div class="space-y-4 text-sm">
          <UAlert
              :color="codegenAiEnabled ? 'success' : 'warning'"
              variant="subtle"
              icon="i-lucide-bot"
              :title="codegenAiEnabled ? $ts('module.system.gen.ai.tokenEnabled') : $ts('module.system.gen.ai.tokenDisabled')"
              :description="$ts('module.system.gen.ai.desc')"
          />

          <p class="text-xs text-muted">
            {{ $ts('module.system.gen.ai.oneClickTip') }}
          </p>

          <div>
            <div class="mb-1 font-medium">{{ $ts('module.system.gen.ai.endpoints') }}</div>
            <pre class="overflow-auto rounded-md bg-gray-50 p-3 text-xs leading-5 dark:bg-gray-900">{{ aiEndpoints }}</pre>
          </div>

          <div>
            <div class="mb-1 font-medium">{{ $ts('module.system.gen.ai.commands') }}</div>
            <pre class="overflow-auto rounded-md bg-gray-50 p-3 text-xs leading-5 dark:bg-gray-900">{{ aiCommands }}</pre>
          </div>

          <div>
            <div class="mb-1 font-medium">{{ $ts('module.system.gen.ai.prompt') }}</div>
            <pre class="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs leading-5 dark:bg-gray-900">{{ aiPrompt }}</pre>
          </div>
        </div>
      </template>
      <template #footer>
        <UButton color="neutral" variant="subtle" @click="aiVisible = false">
          {{ $ts('common.close') }}
        </UButton>
        <UButton color="neutral" variant="outline" icon="i-lucide-copy" @click="copyAiPrompt">
          {{ $ts('module.system.gen.ai.copyPrompt') }}
        </UButton>
        <UButton to="/docs/main/new-module/codegen-v2" target="_blank" icon="i-lucide-book-open">
          {{ $ts('module.system.gen.ai.docs') }}
        </UButton>
      </template>
    </UModal>

    <!-- 编辑生成配置 -->
    <UModal
        v-model:open="editVisible"
        :title="$ts('module.system.gen.editConfig')"
        :dismissible="!saving"
        :ui="{ content: 'w-[calc(100vw-2rem)] max-w-6xl overflow-hidden', body: 'max-h-[70vh] overflow-auto p-4 sm:p-6' }"
    >
      <template #body>
        <div v-if="editConfig" class="space-y-4">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            <UFormField :label="$ts('module.system.gen.moduleName')">
              <UInput v-model="editForm.moduleName" class="w-full" />
            </UFormField>
            <UFormField :label="$ts('module.system.gen.businessName')">
              <UInput v-model="editForm.businessName" class="w-full" />
            </UFormField>
            <UFormField :label="$ts('module.system.gen.author')">
              <UInput v-model="editForm.author" class="w-full" />
            </UFormField>
            <UFormField :label="$ts('module.system.gen.tableComment')" class="md:col-span-2">
              <UInput v-model="editForm.tableComment" class="w-full" />
            </UFormField>
            <UFormField :label="$ts('module.system.gen.remark')">
              <UInput v-model="editForm.remark" class="w-full" />
            </UFormField>
          </div>

          <div class="overflow-auto rounded-md border border-gray-200 dark:border-gray-800">
            <table class="w-full min-w-[980px] text-left text-xs">
              <thead class="bg-gray-50 text-gray-500 dark:bg-gray-900">
                <tr>
                  <th class="px-2 py-2">{{ $ts('module.system.gen.columnName') }}</th>
                  <th class="px-2 py-2">{{ $ts('module.system.gen.propertyName') }}</th>
                  <th class="px-2 py-2">{{ $ts('module.system.gen.tsType') }}</th>
                  <th class="px-2 py-2">{{ $ts('module.system.gen.queryType') }}</th>
                  <th class="px-2 py-2">{{ $ts('module.system.gen.htmlType') }}</th>
                  <th class="px-2 py-2">{{ $ts('module.system.gen.dictCode') }}</th>
                  <th class="px-2 py-2 text-center">{{ $ts('module.system.gen.flags') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="column in editColumns" :key="column.id" class="border-t border-gray-100 dark:border-gray-800">
                  <td class="px-2 py-1 font-mono">{{ column.columnName }}</td>
                  <td class="px-2 py-1"><UInput v-model="column.propertyName" size="xs" class="w-32" /></td>
                  <td class="px-2 py-1">
                    <USelect v-model="column.tsType" :items="tsTypeItems" size="xs" class="w-24" />
                  </td>
                  <td class="px-2 py-1">
                    <USelect v-model="column.queryType" :items="queryTypeItems" size="xs" class="w-20" />
                  </td>
                  <td class="px-2 py-1">
                    <USelect v-model="column.htmlType" :items="htmlTypeItems" size="xs" class="w-28" />
                  </td>
                  <td class="px-2 py-1"><UInput v-model="column.dictCode" size="xs" class="w-28" /></td>
                  <td class="px-2 py-1">
                    <div class="flex flex-wrap items-center justify-center gap-2">
                      <UCheckbox
                          v-for="flag in flagItems"
                          :key="flag.key"
                          :model-value="Number(column[flag.key] ?? 0) === 1"
                          :label="flag.label"
                          @update:model-value="setFlag(column, flag.key, $event)"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
      <template #footer>
        <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" :disabled="saving" @click="editVisible = false" />
        <UButton :label="$ts('common.confirm')" color="primary" :loading="saving" @click="handleSave" />
      </template>
    </UModal>

    <!-- 预览 -->
    <UModal
        v-model:open="previewVisible"
        :title="$ts('module.system.gen.preview')"
        :ui="{ content: 'w-[calc(100vw-2rem)] max-w-6xl overflow-hidden', body: 'p-0' }"
    >
      <template #body>
        <div class="flex h-[70vh] min-h-0">
          <div class="w-64 shrink-0 overflow-auto border-r border-gray-200 p-2 dark:border-gray-800">
            <GenFileTreeNode
                v-for="node in previewTree"
                :key="node.id"
                :node="node"
                :selected-path="selectedFile?.path"
                @select="handleSelectPreviewFile"
            />
          </div>
          <pre class="min-w-0 flex-1 overflow-auto p-3 text-xs leading-5">{{ selectedFile?.content }}</pre>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'
import type { GenDbTable, GenFile, GenTableConfig, GenTableDto } from '#admin/shared/system/gen'
import TableWithPagination from '#admin/app/components/table/TableWithPagination.vue'
import { usePaginatedTable } from '#admin/app/composables/useTable'
import type { MobileRowAction } from '#admin/app/composables/useTable'
import { useToastSuccess } from '#admin/app/utils/toast'
import { copyToClipboard } from '#admin/app/utils/clipboard'
import { buildGenFileTree, downloadGenZip } from '#admin/app/utils/gen'

definePageMeta({
  layout: 'system',
  title: '代码生成 V2',
  icon: 'i-lucide-wand-sparkles',
})

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const toast = useToast()
const { hasPermission } = useRbacProfile()
const runtimeConfig = useRuntimeConfig()
const codegenAiEnabled = computed(() => runtimeConfig.public.codegenAiEnabled === true)
const tableRef = useTemplateRef('table')
const filters = reactive({ tableName: '', tableComment: '' })
const genFormItemUi = {
  root: 'flex items-center',
  label: 'w-24 whitespace-nowrap text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const aiVisible = ref(false)
const aiEndpoints = `GET  /api/system/gen/ai/guide
GET  /api/system/gen/ai/tables
GET  /api/system/gen/ai/prompt?tableId=<id>
POST /api/system/gen/ai/plan
POST /api/system/gen/ai/download

Authorization: Bearer <CODEGEN_TOKEN>`
const aiCommands = `pnpm gen:ai:guide
pnpm gen:ai:tables
pnpm gen:ai:plan --table=sys_demo --module=system/demo --business=SysDemo
pnpm gen:ai:download --table=sys_demo --out=.data/codegen

# CLI 环境变量
CODEGEN_BASE_URL=http://127.0.0.1:3001
CODEGEN_TOKEN=<NUXT_CODEGEN_TOKEN>`
const aiPrompt = `请先读取 /api/system/gen/ai/guide（或 /docs/main/new-module/codegen-v2），然后：
1. 运行 pnpm gen:ai:plan --table=<tableName> [--module=<module>] [--business=<Business>]；
2. 按返回的 files 写入文件；
3. 按 mergePlan 合并 schema/index.ts、routers.ts、app/locales/zh.json、app/locales/en.json；
4. 执行 mergePlan.menuSql（替换占位 UUID）；
5. 运行 pnpm --filter xxdl-nuxt-admin-demo typecheck 和 pnpm check:layers；
6. 如果失败，读取错误并修正生成文件后重试，不要改动无关文件。`

const copyAiPrompt = async () => {
  if (await copyToClipboard(aiPrompt)) {
    useToastSuccess($ts('common.copySuccess'))
  }
}

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage,
} = usePaginatedTable<GenTableDto>({
  query: params => $trpc.sysGen.page.query({
    ...params,
    tableName: filters.tableName.trim() || undefined,
    tableComment: filters.tableComment.trim() || undefined,
  }),
  pageSizeOptions: [10, 20, 50],
})

const handleSearch = async () => getDataByPage(1)
const handleReset = async () => {
  filters.tableName = ''
  filters.tableComment = ''
  await handleSearch()
}

const importVisible = ref(false)
const dbKeyword = ref('')
const importing = ref(false)
const dbTables = ref<GenDbTable[]>([])
const selectedTables = ref<string[]>([])
const filteredDbTables = computed(() => {
  const keyword = dbKeyword.value.trim().toLowerCase()
  return dbTables.value.filter(item => !keyword
    || item.tableName.toLowerCase().includes(keyword)
    || item.tableComment.toLowerCase().includes(keyword))
})

const openImport = async () => {
  selectedTables.value = []
  dbKeyword.value = ''
  importVisible.value = true
  dbTables.value = await $trpc.sysGen.dbTables.query()
}

const toggleTable = (tableName: string, checked: boolean | 'indeterminate') => {
  if (checked === true) {
    if (!selectedTables.value.includes(tableName)) {
      selectedTables.value = [...selectedTables.value, tableName]
    }
    return
  }

  selectedTables.value = selectedTables.value.filter(item => item !== tableName)
}

const handleImport = async () => {
  if (selectedTables.value.length === 0) return
  importing.value = true
  try {
    await $trpc.sysGen.importTables.mutate({ tableNames: selectedTables.value })
    useToastSuccess($ts('module.system.gen.importSuccess'))
    importVisible.value = false
    await refresh()
  } finally {
    importing.value = false
  }
}

const editVisible = ref(false)
const saving = ref(false)
const editConfig = ref<GenTableConfig | null>(null)
type EditColumn = {
  id: string
  columnName: string
  columnComment: string
  columnType: string
  tsType: string
  propertyName: string
  isPk: number
  isRequired: number
  isInsert: number
  isEdit: number
  isList: number
  isQuery: number
  queryType: string
  dictCode: string
  htmlType: string
  sortOrder: number
}
const editColumns = ref<EditColumn[]>([])
const editForm = reactive({
  id: '',
  tableComment: '',
  moduleName: '',
  businessName: '',
  author: '',
  remark: '',
})

const tsTypeItems = ['string', 'number', 'boolean', 'unknown']
const queryTypeItems = ['eq', 'like']
const htmlTypeItems = ['input', 'textarea', 'select', 'number', 'date', 'password', 'switch']
const flagItems: Array<{ key: keyof EditColumn, label: string }> = [
  { key: 'isPk', label: 'PK' },
  { key: 'isRequired', label: '必填' },
  { key: 'isInsert', label: '新增' },
  { key: 'isEdit', label: '编辑' },
  { key: 'isList', label: '列表' },
  { key: 'isQuery', label: '查询' },
]

const openEdit = async (row: GenTableDto) => {
  if (!row.id) return
  editConfig.value = await $trpc.sysGen.getConfig.query(row.id)
  editColumns.value = editConfig.value.columns.map(column => ({
    id: column.id ?? '',
    columnName: column.columnName ?? '',
    columnComment: column.columnComment ?? '',
    columnType: column.columnType ?? '',
    tsType: column.tsType ?? 'string',
    propertyName: column.propertyName ?? '',
    isPk: Number(column.isPk ?? 0),
    isRequired: Number(column.isRequired ?? 0),
    isInsert: Number(column.isInsert ?? 0),
    isEdit: Number(column.isEdit ?? 0),
    isList: Number(column.isList ?? 0),
    isQuery: Number(column.isQuery ?? 0),
    queryType: column.queryType ?? 'eq',
    dictCode: column.dictCode ?? '',
    htmlType: column.htmlType ?? 'input',
    sortOrder: Number(column.sortOrder ?? 0),
  }))
  Object.assign(editForm, {
    id: row.id,
    tableComment: editConfig.value.table.tableComment ?? '',
    moduleName: editConfig.value.table.moduleName ?? '',
    businessName: editConfig.value.table.businessName ?? '',
    author: editConfig.value.table.author ?? '',
    remark: editConfig.value.table.remark ?? '',
  })
  editVisible.value = true
}

const setFlag = (column: EditColumn, key: keyof EditColumn, value: boolean | 'indeterminate') => {
  ;(column as any)[key] = value === true ? 1 : 0
}

const handleSave = async () => {
  if (!editConfig.value) return
  saving.value = true
  try {
    await $trpc.sysGen.updateTable.mutate({
      id: editForm.id,
      tableComment: editForm.tableComment || undefined,
      moduleName: editForm.moduleName,
      businessName: editForm.businessName,
      author: editForm.author || undefined,
      remark: editForm.remark || undefined,
    })
    await $trpc.sysGen.saveColumns.mutate({
      tableId: editForm.id,
      columns: editColumns.value.map(column => ({
        id: column.id,
        columnName: column.columnName,
        columnComment: column.columnComment || undefined,
        columnType: column.columnType || undefined,
        tsType: column.tsType,
        propertyName: column.propertyName,
        isPk: column.isPk,
        isRequired: column.isRequired,
        isInsert: column.isInsert,
        isEdit: column.isEdit,
        isList: column.isList,
        isQuery: column.isQuery,
        queryType: column.queryType,
        dictCode: column.dictCode || undefined,
        htmlType: column.htmlType,
        sortOrder: column.sortOrder,
      })),
    })
    useToastSuccess($ts('common.modifySuccess'))
    editVisible.value = false
    await refresh()
  } finally {
    saving.value = false
  }
}

const previewVisible = ref(false)
const previewFiles = ref<GenFile[]>([])
const previewTree = computed(() => buildGenFileTree(previewFiles.value))
const selectedFile = ref<GenFile | null>(null)

const handleSelectPreviewFile = (path: string) => {
  selectedFile.value = previewFiles.value.find(file => file.path === path) ?? null
}

const openPreview = async (row: GenTableDto) => {
  if (!row.id) return
  previewFiles.value = await $trpc.sysGen.preview.query({ id: row.id })
  selectedFile.value = previewFiles.value[0] ?? null
  previewVisible.value = true
}

const handleDownload = async (row: GenTableDto) => {
  if (!row.id) return
  await downloadGenZip(row.id, `${row.tableName}-codegen.zip`)
}

/** 列表行「AI」：取回已替换变量、带短期令牌的提示词并复制。 */
const handleAiCopy = async (row: GenTableDto) => {
  if (!row.id) return

  try {
    const response = await $fetch<{
      success: boolean
      data: { prompt: string, tokenMode: 'static' | 'ephemeral', expiresAt: string | null }
    }>('/api/system/gen/ai/prompt', {
      query: { tableId: row.id },
    })

    const copied = await copyToClipboard(response.data.prompt)
    if (!copied) {
      toast.add({ title: $ts('module.system.gen.ai.copyRowFailed'), color: 'error' })
      return
    }

    toast.add({
      title: $ts(response.data.tokenMode === 'static'
        ? 'module.system.gen.ai.copyRowSuccessLong'
        : 'module.system.gen.ai.copyRowSuccessShort'),
      color: 'success',
    })
  }
  catch {
    toast.add({ title: $ts('module.system.gen.ai.copyRowFailed'), color: 'error' })
  }
}

const handleDelete = async (row: GenTableDto) => {
  if (!row.id) return
  await $trpc.sysGen.remove.mutate(row.id)
  await refresh()
}

/** 移动端行操作：点击「⋯」在按钮下方展示 */
const rowActions = (row: GenTableDto): MobileRowAction[] => {
  const items: MobileRowAction[] = []

  if (hasPermission('system:gen:edit')) {
    items.push({
      label: $ts('common.edit'),
      icon: 'i-lucide-settings-2',
      color: 'primary',
      onSelect: () => openEdit(row)
    })
  }

  if (hasPermission('system:gen:preview')) {
    items.push({
      label: $ts('module.system.gen.preview'),
      icon: 'i-lucide-eye',
      color: 'info',
      onSelect: () => openPreview(row)
    })
  }

  items.push({
    label: $ts('module.system.gen.ai.button'),
    icon: 'i-lucide-sparkles',
    onSelect: () => handleAiCopy(row)
  })

  if (hasPermission('system:gen:download')) {
    items.push({
      label: $ts('module.system.gen.download'),
      icon: 'i-lucide-download',
      onSelect: () => handleDownload(row)
    })
  }

  if (hasPermission('system:gen:del')) {
    items.push({
      label: $ts('common.delete'),
      icon: 'i-lucide-trash-2',
      color: 'error',
      confirm: $ts('common.confirmDelete', { count: 1 }),
      onSelect: () => handleDelete(row)
    })
  }

  return items
}

const columns = computed<TableColumn<GenTableDto>[]>(() => {
  const actionColumn: TableColumn<GenTableDto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      if (hasPermission('system:gen:edit')) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          icon: 'i-lucide-settings-2',
          onClick: () => openEdit(row.original),
        }, { default: () => $ts('common.edit') }))
      }

      if (hasPermission('system:gen:preview')) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'info',
          size: 'xs',
          icon: 'i-lucide-eye',
          onClick: () => openPreview(row.original),
        }, { default: () => $ts('module.system.gen.preview') }))
      }

      actions.push(h(UButton, {
        variant: 'outline',
        color: 'primary',
        size: 'xs',
        icon: 'i-lucide-sparkles',
        onClick: () => handleAiCopy(row.original),
      }, { default: () => $ts('module.system.gen.ai.button') }))

      if (hasPermission('system:gen:download')) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'neutral',
          size: 'xs',
          icon: 'i-lucide-download',
          onClick: () => handleDownload(row.original),
        }, { default: () => $ts('module.system.gen.download') }))
      }

      if (hasPermission('system:gen:del')) {
        actions.push(h(Popconfirm, {
          onConfirm: () => handleDelete(row.original),
        }, {
          trigger: () => h(UButton, {
            variant: 'outline',
            color: 'error',
            size: 'xs',
            icon: 'i-lucide-trash-2',
          }, { default: () => $ts('common.delete') }),
        }))
      }

      return h('div', { class: 'flex flex-wrap gap-2' }, actions)
    },
  }

  return [
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => h('span', { class: 'text-gray-500 dark:text-gray-400' },
        (pagination.page - 1) * pagination.pageSize + row.index + 1),
    },
    { accessorKey: 'tableName', header: () => $ts('module.system.gen.tableName') },
    { accessorKey: 'tableComment', header: () => $ts('module.system.gen.tableComment') },
    { accessorKey: 'moduleName', header: () => $ts('module.system.gen.moduleName') },
    { accessorKey: 'businessName', header: () => $ts('module.system.gen.businessName') },
    { accessorKey: 'updatedAt', header: () => $ts('common.updatedAt') },
    actionColumn,
  ]
})

onMounted(async () => {
  await search()
})
</script>

<style scoped>
@media (max-width: 640px) {
  :deep(table) {
    display: table;
    min-width: 900px;
    width: 100%;
  }
}
</style>
