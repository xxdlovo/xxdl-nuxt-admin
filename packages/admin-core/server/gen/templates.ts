import type { GenColumnDto } from '#admin/shared/system/gen'
import type { GenFile } from '#admin/shared/system/gen'
import { resolveGenTable, toCamel, toKebab, toPascal, zodTypeOf, type ResolvedGenTable } from './naming'

/**
 * 代码生成模板。
 *
 * 输出按 packages/admin-core 的目录布局生成，使用 `#admin/*` 别名；
 * 不在运行时改写仓库，由用户下载 zip 后按 README 合并。
 */

type TableConfig = ResolvedGenTable

function flag(column: GenColumnDto, key: keyof GenColumnDto) {
    return Number(column[key] ?? 0) === 1
}

function isAudit(column: GenColumnDto) {
    return ['created_by', 'created_at', 'updated_by', 'updated_at', 'is_deleted'].includes(String(column.columnName))
}

function isPk(column: GenColumnDto) {
    return flag(column, 'isPk') || column.columnName === 'id'
}

function addColumns(config: TableConfig) {
    return config.columns.filter(column => flag(column, 'isInsert') && !isPk(column))
}

function editColumns(config: TableConfig) {
    return config.columns.filter(column => flag(column, 'isEdit') && !isPk(column))
}

function listColumns(config: TableConfig) {
    return config.columns.filter(column => flag(column, 'isList'))
}

function queryColumns(config: TableConfig) {
    return config.columns.filter(column => flag(column, 'isQuery'))
}

function property(column: GenColumnDto) {
    return String(column.propertyName ?? toCamel(String(column.columnName ?? '')))
}

function columnName(column: GenColumnDto) {
    return String(column.columnName ?? '')
}

function comment(column: GenColumnDto) {
    return String(column.columnComment ?? '') || property(column)
}

function zType(column: GenColumnDto) {
    return zodTypeOf(column)
}

function requiredZType(column: GenColumnDto) {
    if (column.tsType === 'number') {
        return 'z.number()'
    }
    if (column.tsType === 'boolean') {
        return 'z.boolean()'
    }
    if (column.tsType === 'unknown') {
        return 'z.unknown()'
    }
    return `z.string().min(1, 'form.required')`
}

function stateDefault(column: GenColumnDto) {
    if (column.columnName === 'status') {
        return '1'
    }
    if (column.tsType === 'number') {
        return '0'
    }
    if (column.tsType === 'boolean') {
        return 'false'
    }
    if (column.tsType === 'unknown') {
        return 'null'
    }
    return "''"
}

function drizzleColumn(column: GenColumnDto) {
    const rawType = String(column.columnType ?? 'varchar(255)').toLowerCase().trim()
    const base = rawType.replace(/\(.*/, '')
    const lengthMatch = /\((\d+)/.exec(rawType)
    const decimalMatch = /\((\d+)\s*,\s*(\d+)\)/.exec(rawType)
    const imports = new Set<string>()
    const name = columnName(column)
    const field = property(column)

    const call = (fn: string, extra?: string) => {
        const args = [name === field ? '' : `"${name}"`, extra ?? ''].filter(Boolean).join(', ')
        return `${fn}(${args})`
    }

    let builder = call('varchar', `{ length: ${lengthMatch?.[1] ?? 255} }`)
    imports.add('varchar')

    switch (base) {
        case 'char':
            imports.add('char')
            builder = call('char', `{ length: ${lengthMatch?.[1] ?? 36} }`)
            break
        case 'varchar':
            imports.add('varchar')
            builder = call('varchar', `{ length: ${lengthMatch?.[1] ?? 255} }`)
            break
        case 'tinytext':
        case 'text':
        case 'mediumtext':
        case 'longtext':
            imports.add('text')
            builder = call('text')
            break
        case 'tinyint':
            imports.add('tinyint')
            builder = call('tinyint')
            break
        case 'smallint':
            imports.add('smallint')
            builder = call('smallint')
            break
        case 'mediumint':
        case 'int':
        case 'integer':
            imports.add('int')
            builder = call('int')
            break
        case 'bigint':
            imports.add('bigint')
            builder = call('bigint', `{ mode: 'number' }`)
            break
        case 'decimal':
        case 'numeric':
            imports.add('decimal')
            builder = call('decimal', `{ precision: ${decimalMatch?.[1] ?? 10}, scale: ${decimalMatch?.[2] ?? 2} }`)
            break
        case 'float':
            imports.add('float')
            builder = call('float')
            break
        case 'double':
            imports.add('double')
            builder = call('double')
            break
        case 'date':
            imports.add('date')
            builder = call('date', `{ mode: 'string' }`)
            break
        case 'datetime':
            imports.add('datetime')
            builder = call('datetime', `{ mode: 'string' }`)
            break
        case 'timestamp':
            imports.add('timestamp')
            builder = call('timestamp', `{ mode: 'string' }`)
            break
        case 'time':
            imports.add('time')
            builder = call('time')
            break
        case 'json':
            imports.add('json')
            builder = call('json')
            break
        default:
            imports.add('varchar')
            builder = call('varchar', `{ length: ${lengthMatch?.[1] ?? 255} }`)
    }

    let expression = `${field}: ${builder}`

    if (name === 'created_at') {
        return { imports, expression: `${expression}.defaultNow().notNull()` }
    }
    if (name === 'updated_at') {
        return { imports, expression: `${expression}.defaultNow().onUpdateNow().notNull()` }
    }
    if (name === 'is_deleted') {
        return { imports, expression: `${expression}.default(0)` }
    }
    if (name === 'status') {
        return { imports, expression: `${expression}.default(1)` }
    }
    if (flag(column, 'isRequired') || isPk(column)) {
        expression += '.notNull()'
    }

    return { imports, expression }
}

function buildSchema(config: TableConfig): GenFile {
    const imports = new Set<string>(['mysqlTable', 'primaryKey'])
    const lines = config.columns.map((column) => {
        const result = drizzleColumn(column)
        result.imports.forEach(item => imports.add(item))
        return `\t${result.expression},`
    })
    const pkColumn = config.columns.find(column => isPk(column))
    const pkLines = pkColumn
        ? `\tprimaryKey({ columns: [table.${property(pkColumn)}], name: "${config.tableName}_id" }),`
        : ''

    const content = `import { ${Array.from(imports).join(', ')} } from "drizzle-orm/mysql-core"

export const ${config.schemaVar} = mysqlTable("${config.tableName}", {
${lines.join('\n')}
},
(table) => [
${pkLines}
])
`

    return { path: config.schemaPath, content, language: 'typescript' }
}

function buildCommon(config: TableConfig): GenFile {
    const fields = config.columns.map((column) => {
        const meta = flag(column, 'isQuery') && column.queryType === 'like'
            ? `.meta({ query: 'like' })`
            : ''
        return `    ${property(column)}: ${zType(column)}.nullish()${meta},`
    })

    const content = `import z from 'zod'

export const ${config.businessName}BaseSchema = z.object({
${fields.join('\n')}
})
export type ${config.businessName}Dto = z.infer<typeof ${config.businessName}BaseSchema>
`

    return { path: `${config.sharedDir}/common.ts`, content, language: 'typescript' }
}

function buildInput(config: TableConfig): GenFile {
    const add = addColumns(config)
    const update = editColumns(config)
    const query = queryColumns(config)

    const pick = (columns: GenColumnDto[]) => columns.length
        ? `{\n${columns.map(column => `        ${property(column)}: true,`).join('\n')}\n    }`
        : '{}'

    const requiredExtends = (columns: GenColumnDto[]) => columns
        .filter(column => flag(column, 'isRequired'))
        .map(column => `        ${property(column)}: ${requiredZType(column)},`)
        .join('\n')

    const addRequired = requiredExtends(add)
    const updateRequired = requiredExtends(update)

    const content = `import { z } from 'zod'
import { ${config.businessName}BaseSchema } from './common'
import { ApiRequestSchema } from '#admin/shared/types/common'

// add
export const ${config.businessName}AddSchema =
    ${config.businessName}BaseSchema.pick(${pick(add)}).extend({
        id: ${config.businessName}BaseSchema.shape.id.nonoptional(),${addRequired ? `\n${addRequired}` : ''}
    })
export type ${config.businessName}AddDTO = z.infer<typeof ${config.businessName}AddSchema>

// update
export const ${config.businessName}UpdateSchema = ${config.businessName}AddSchema.extend({
    id: z.string().nonempty('form.id.required'),${updateRequired ? `\n${updateRequired}` : ''}
})
export type ${config.businessName}UpdateDTO = z.infer<typeof ${config.businessName}UpdateSchema>

// query
export const ${config.businessName}QuerySchema = ${config.businessName}BaseSchema.pick(${pick(query)})
export type ${config.businessName}QueryDTO = z.infer<typeof ${config.businessName}QuerySchema>

// page query
export const ${config.businessName}PageQuerySchema =
    ${config.businessName}QuerySchema.extend(ApiRequestSchema.shape)
export type ${config.businessName}PageQueryDTO = z.infer<typeof ${config.businessName}PageQuerySchema>
`

    return { path: `${config.sharedDir}/input.ts`, content, language: 'typescript' }
}

function buildOutput(config: TableConfig): GenFile {
    const fields = listColumns(config).map(column => `    ${property(column)}: ${config.businessName}BaseSchema.shape.${property(column)},`)
    const content = `import { ${config.businessName}BaseSchema } from './common'
import { z } from 'zod'

export const ${config.businessName}RespSchema = z.object({
${fields.join('\n')}
})
export type ${config.businessName}RespDTO = z.infer<typeof ${config.businessName}RespSchema>
`

    return { path: `${config.sharedDir}/output.ts`, content, language: 'typescript' }
}

function buildSharedIndex(config: TableConfig): GenFile {
    return {
        path: `${config.sharedDir}/index.ts`,
        content: `export * from './common'\nexport * from './input'\nexport * from './output'\n`,
        language: 'typescript',
    }
}

function buildRepo(config: TableConfig): GenFile {
    const content = `import { CommonRepo } from '#admin/server/drizzle/CommonRepo'
import { ${config.businessName}BaseSchema } from '#admin/${config.sharedDir}'
import { ${config.schemaVar} } from '#admin/server/drizzle/schema'

export const ${config.businessCamel}Repo = CommonRepo(${config.schemaVar}, ${config.businessName}BaseSchema)
`
    return { path: `${config.routerDir}/${config.businessName}Repo.ts`, content, language: 'typescript' }
}

function buildService(config: TableConfig): GenFile {
    const content = `import { useLogger } from 'evlog'
import { ${config.businessCamel}Repo } from './${config.businessName}Repo'
import type { Context } from '#admin/server/trpc/context'
import { AppError } from '#admin/server/utils/appError'
import type { OrmPageResp } from '#admin/server/utils/ApiResp'
import type {
    ${config.businessName}AddDTO,
    ${config.businessName}Dto,
    ${config.businessName}PageQueryDTO,
    ${config.businessName}QueryDTO,
    ${config.businessName}UpdateDTO,
} from '#admin/${config.sharedDir}'
import { randomUuid } from '#admin/shared/utils/uuid'

export function ${config.businessCamel}Service(ctx: Context) {
    const repo = ${config.businessCamel}Repo(ctx)
    const log = useLogger(ctx.event, '${config.routerDir.replace('server/', '')}')

    return {
        async create(data: ${config.businessName}AddDTO): Promise<boolean> {
            const id = randomUuid()
            await repo.create({ ...data, id })
            log.info('${config.businessCamel} created', { ${config.businessCamel}: { action: 'create', id } })
            return true
        },
        async remove(id: string): Promise<boolean> {
            await repo.remove(id)
            log.info('${config.businessCamel} removed', { ${config.businessCamel}: { action: 'remove', id } })
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            log.info('${config.businessCamel} batch removed', { ${config.businessCamel}: { action: 'batchRemove', count: ids.length } })
            return ids.length
        },
        async updateById(id: string, data: ${config.businessName}UpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            log.info('${config.businessCamel} updated', { ${config.businessCamel}: { action: 'update', id } })
            return true
        },
        async getOne(req: ${config.businessName}QueryDTO): Promise<${config.businessName}Dto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            log.info('${config.businessCamel} fetched', { ${config.businessCamel}: { action: 'getOne' } })
            return pojo
        },
        async getById(id: string): Promise<${config.businessName}Dto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            log.info('${config.businessCamel} fetched', { ${config.businessCamel}: { action: 'getById', id } })
            return pojo
        },
        async page(req: ${config.businessName}PageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            const result = await repo.page(page, pageSize, dto)
            log.info('${config.businessCamel} page queried', {
                ${config.businessCamel}: { action: 'page', page, pageSize, total: result.total },
            })
            return result
        },
        async list(dto: any): Promise<${config.businessName}Dto[]> {
            const list = await repo.list(dto)
            log.info('${config.businessCamel} listed', { ${config.businessCamel}: { action: 'list', count: list.length } })
            return list
        },
    }
}
`
    return { path: `${config.routerDir}/${config.businessName}Service.ts`, content, language: 'typescript' }
}

function buildRouter(config: TableConfig): GenFile {
    const content = `import { router, proc } from '#admin/server/trpc/init'
import z from 'zod'
import {
    ${config.businessName}AddSchema,
    ${config.businessName}UpdateSchema,
    ${config.businessName}QuerySchema,
    ${config.businessName}PageQuerySchema,
} from '#admin/${config.sharedDir}'
import { ${config.businessCamel}Service } from './${config.businessName}Service'

const listProc = proc({ permission: '${config.resourceCode}:list' })
const addProc = proc({ permission: '${config.resourceCode}:add' })
const editProc = proc({ permission: '${config.resourceCode}:edit' })
const delProc = proc({ permission: '${config.resourceCode}:del' })

export const ${config.routerKey}Router = router({
    create: addProc.input(${config.businessName}AddSchema)
        .mutation(async ({ ctx, input }) => {
            return ${config.businessCamel}Service(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return ${config.businessCamel}Service(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return ${config.businessCamel}Service(ctx).batchRemove(input)
        }),
    update: editProc.input(${config.businessName}UpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return ${config.businessCamel}Service(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(${config.businessName}QuerySchema)
        .query(async ({ ctx, input }) => {
            return ${config.businessCamel}Service(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return ${config.businessCamel}Service(ctx).getById(input)
        }),
    page: listProc.input(${config.businessName}PageQuerySchema)
        .query(async ({ ctx, input }) => {
            return ${config.businessCamel}Service(ctx).page(input)
        }),
})
`
    return { path: `${config.routerDir}/index.ts`, content, language: 'typescript' }
}

function buildPage(config: TableConfig): GenFile {
    const cols = listColumns(config)
    const columnDefs = cols.map((column) => {
        const label = comment(column)
        return `    {\n        accessorKey: '${property(column)}',\n        header: () => $ts('${config.i18nKey}.${property(column)}'),\n    },`
    }).join('\n')

    const content = `<template>
  <div class="flex h-full flex-col gap-3 p-3">
    <div class="shrink-0">
      <${config.businessName}Search v-model:model="searchParams" @search="getDataByPage(1, searchParams)" />
    </div>

    <UCard class="flex min-h-0 flex-1 flex-col overflow-hidden" :ui="{ body: 'flex h-full flex-col p-0 sm:p-0' }">
      <TableWithPagination
          ref="table"
          :data="data"
          :columns="columns"
          :loading="loading"
          :pagination="pagination"
          :page-size-options="pageSizeOptions"
      >
        <template #header>
          <TableHeaderOperation
              v-if="tableRef?.tableRef"
              :table-ref="tableRef?.tableRef"
              :loading="loading"
              :disabled-delete="checkedRowKeys.length === 0 || loading"
              :selected-count="checkedRowKeys.length"
              :add-permission="permissions.codes.add"
              :delete-permission="permissions.codes.del"
              class="shrink-0 border-b border-gray-200 px-4 py-2 dark:border-gray-800"
              @add="handleAdd"
              @delete="handleBatchDelete"
              @refresh="refresh"
          >
            <template #prefix>
              <span>{{ $ts('${config.i18nKey}.title') }}</span>
            </template>
          </TableHeaderOperation>

          <${config.businessName}Operate
              v-model:visible="drawerVisible"
              :operate-type="operateType"
              :data="editingData ?? undefined"
              :close="closeVisible"
              :refresh="refresh"
          />
        </template>
      </TableWithPagination>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Component } from 'vue'
import { h } from 'vue'
import type { ${config.businessName}Dto, ${config.businessName}QueryDTO } from '#admin/${config.sharedDir}'
import TableWithPagination from '#admin/app/components/table/TableWithPagination.vue'
import { usePaginatedTable, useSelectionColumn, useTableOperate } from '#admin/app/composables/useTable'
import ${config.businessName}Search from './components/${config.componentPrefix}-search.vue'
import ${config.businessName}Operate from './components/${config.componentPrefix}-operate.vue'

definePageMeta({
  layout: 'system',
  title: '${config.tableComment.replace(/'/g, "\\'")}',
  icon: 'i-lucide-table',
})

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const tableRef = useTemplateRef('table')
const permissions = useCrudPermissions('${config.resourceCode}')
const searchParams = ref<${config.businessName}QueryDTO>({})

const {
  data,
  loading,
  pagination,
  pageSizeOptions,
  search,
  refresh,
  getDataByPage,
} = usePaginatedTable<${config.businessName}Dto>({
  query: params => $trpc.${config.routerKey}.page.query(params),
  pageSizeOptions: [10, 20, 50, 100],
})

const {
  operateType,
  editingData,
  drawerVisible,
  checkedRowKeys,
  handleAdd,
  handleEdit,
  onDeleted,
  onBatchDeleted,
  closeVisible,
} = useTableOperate<${config.businessName}Dto>({
  data,
  idKey: 'id',
  refresh,
})

const UCheckbox = resolveComponent('UCheckbox')
const { selectionColumn } = useSelectionColumn<${config.businessName}Dto>({
  data,
  checkedRowKeys,
  checkboxComponent: UCheckbox as Component,
})

const columns = computed<TableColumn<${config.businessName}Dto>[]>(() => {
  const actionColumn: TableColumn<${config.businessName}Dto> = {
    id: 'actions',
    header: () => $ts('common.operate'),
    cell: ({ row }) => {
      const UButton = resolveComponent('UButton')
      const Popconfirm = resolveComponent('Popconfirm')
      const actions = []

      if (permissions.canEdit.value) {
        actions.push(h(UButton, {
          variant: 'outline',
          color: 'primary',
          size: 'xs',
          onClick: () => handleEdit(row.original.id as string),
        }, { default: () => $ts('common.edit') }))
      }

      if (permissions.canDel.value) {
        actions.push(h(Popconfirm, {
          onConfirm: () => handleDelete(row.original.id as string),
        }, {
          trigger: () => h(UButton, {
            variant: 'outline',
            color: 'error',
            size: 'xs',
          }, { default: () => $ts('common.delete') }),
        }))
      }

      return h('div', { class: 'flex gap-2' }, actions)
    },
  }

  return [
    ...(permissions.canDel.value ? [selectionColumn] : []),
    {
      id: 'index',
      header: () => $ts('common.index'),
      cell: ({ row }) => h('span', { class: 'text-gray-500 dark:text-gray-400' },
        (pagination.page - 1) * pagination.pageSize + row.index + 1),
    },
${columnDefs}
    ...(permissions.canOperate.value ? [actionColumn] : []),
  ]
})

const handleDelete = async (id: string) => {
  if (loading.value) return
  await $trpc.${config.routerKey}.remove.mutate(id)
  await onDeleted()
}

const handleBatchDelete = async () => {
  if (loading.value || checkedRowKeys.value.length === 0) return
  await $trpc.${config.routerKey}.batchDelete.mutate(checkedRowKeys.value)
  await onBatchDeleted()
}

onMounted(async () => {
  await search()
})
</script>

<style scoped>
@media (max-width: 640px) {
  :deep(table) {
    display: table;
    min-width: 760px;
    width: 100%;
  }
}
</style>
`
    return { path: `${config.pageDir}/index.vue`, content, language: 'vue' }
}

function searchField(column: GenColumnDto, config: TableConfig) {
    const prop = property(column)
    const label = comment(column)
    const placeholder = `$ts('${config.i18nKey}.form.${prop}')`

    if (column.columnName === 'status') {
        return `            <UFormField name="${prop}" :label="$ts('${config.i18nKey}.${prop}')" orientation="horizontal" :ui="formItemUi">
              <USelect v-model.nullable="state.${prop}" :items="statusItems" clearable class="w-full" />
            </UFormField>`
    }

    if (column.dictCode) {
        return `            <UFormField name="${prop}" :label="$ts('${config.i18nKey}.${prop}')" orientation="horizontal" :ui="formItemUi">
              <USelect v-model.nullable="state.${prop}" :items="dict_${prop}" clearable class="w-full" />
            </UFormField>`
    }

    if (column.tsType === 'number') {
        return `            <UFormField name="${prop}" :label="$ts('${config.i18nKey}.${prop}')" orientation="horizontal" :ui="formItemUi">
              <UInputNumber v-model="state.${prop}" class="w-full" />
            </UFormField>`
    }

    return `            <UFormField name="${prop}" :label="$ts('${config.i18nKey}.${prop}')" orientation="horizontal" :ui="formItemUi">
              <UBaseInput v-model="state.${prop}" :placeholder="${placeholder}" trailing="clear" class="w-full" />
            </UFormField>`
}

function buildSearch(config: TableConfig): GenFile {
    const fields = queryColumns(config).map(column => searchField(column, config)).join('\n')
    const dictSetup = queryColumns(config)
        .filter(column => column.dictCode && column.columnName !== 'status')
        .map(column => `const dict_${property(column)} = useDictOptions('${column.dictCode}')`)
        .join('\n')

    const content = `<template>
  <UCard class="w-full" :ui="{ body: 'p-0 sm:p-0 pl-2 sm:pl-2' }">
    <UAccordion v-model="active" :items="items">
      <template #leading="{ open }">
        <UIcon :name="open ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="cursor-pointer" />
      </template>
      <template #trailing>&nbsp;</template>
      <template #content>
        <UForm ref="form" :schema="schema" :state="state" :validate-on="['input']" class="p-2">
          <div class="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
${fields}
            <div class="flex flex-col pr-8 lg:col-start-4">
              <div class="flex justify-end gap-2">
                <UButton icon="tabler:reload" color="neutral" variant="outline" @click="reset">{{ $ts('common.reset') }}</UButton>
                <UButton icon="tabler:search" variant="outline" @click="submit">{{ $ts('common.search') }}</UButton>
              </div>
            </div>
          </div>
        </UForm>
      </template>
    </UAccordion>
  </UCard>
</template>

<script setup lang="ts">
import { ${config.businessName}QuerySchema, type ${config.businessName}QueryDTO } from '#admin/${config.sharedDir}'
import { businessDictCode } from '#admin/shared/constants/business'

const { $ts } = useI18n()
const emit = defineEmits<{ search: [data: ${config.businessName}QueryDTO] }>()
const form = useTemplateRef('form')
const active = ref(undefined)
const state = defineModel<${config.businessName}QueryDTO>('model', { required: true })
const schema = ${config.businessName}QuerySchema
const statusItems = useDictNumberOptions(businessDictCode.enableStatus)
${dictSetup}
const items = computed(() => [{ label: $ts('common.search'), icon: '' }])
const formItemUi = {
  root: 'flex items-center',
  label: 'w-20 shrink-0 pr-2 text-right',
  container: 'flex-1',
}

const submit = async () => {
  if (await form.value?.validate({})) emit('search', state.value)
}

const reset = () => {
  form.value?.clear()
  state.value = {}
}
</script>
`
    return { path: `${config.pageDir}/components/${config.componentPrefix}-search.vue`, content, language: 'vue' }
}

function operateField(column: GenColumnDto, config: TableConfig) {
    const prop = property(column)
    const placeholder = `$ts('${config.i18nKey}.form.${prop}')`
    const label = `$ts('${config.i18nKey}.${prop}')`

    if (column.htmlType === 'textarea') {
        return `          <UFormField name="${prop}" :label="${label}" orientation="horizontal" :ui="formItemUi" class="sm:col-span-2">
            <UTextarea v-model="state.${prop}" :placeholder="${placeholder}" :rows="3" class="w-full" />
          </UFormField>`
    }

    if (column.htmlType === 'number') {
        return `          <UFormField name="${prop}" :label="${label}" orientation="horizontal" :ui="formItemUi">
            <UInputNumber v-model="state.${prop}" class="w-full" />
          </UFormField>`
    }

    if (column.htmlType === 'date') {
        return `          <UFormField name="${prop}" :label="${label}" orientation="horizontal" :ui="formItemUi">
            <UInput v-model="state.${prop}" type="date" class="w-full" />
          </UFormField>`
    }

    if (column.columnName === 'status') {
        return `          <UFormField name="${prop}" :label="${label}" orientation="horizontal" :ui="formItemUi">
            <URadioGroup v-model="statusValue" orientation="horizontal" :items="statusItems" />
          </UFormField>`
    }

    if (column.dictCode) {
        return `          <UFormField name="${prop}" :label="${label}" orientation="horizontal" :ui="formItemUi">
            <USelect v-model="state.${prop}" :items="dict_${prop}" class="w-full" />
          </UFormField>`
    }

    return `          <UFormField name="${prop}" :label="${label}" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.${prop}" :placeholder="${placeholder}" trailing="${column.htmlType === 'password' ? 'password' : 'clear'}" class="w-full" />
          </UFormField>`
}

function buildOperate(config: TableConfig): GenFile {
    const fields = editColumns(config).map(column => operateField(column, config)).join('\n')
    const stateFields = editColumns(config)
        .map(column => `  ${property(column)}: ${stateDefault(column)},`)
        .join('\n')
    const hasStatus = editColumns(config).some(column => column.columnName === 'status')
    const dictSetup = editColumns(config)
        .filter(column => column.dictCode && column.columnName !== 'status')
        .map(column => `const dict_${property(column)} = useDictOptions('${column.dictCode}')`)
        .join('\n')

    const content = `<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import {
  ${config.businessName}AddSchema,
  type ${config.businessName}AddDTO,
  type ${config.businessName}Dto,
  ${config.businessName}UpdateSchema,
  type ${config.businessName}UpdateDTO,
} from '#admin/${config.sharedDir}'
import { businessDictCode } from '#admin/shared/constants/business'
import { useToastSuccess } from '#admin/app/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const props = defineProps<{
  visible: boolean
  operateType: string
  data?: ${config.businessName}Dto
  close?: () => void
  refresh?: () => void
}>()
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()
const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value),
})

const state = ref<any>({
  id: '',
${stateFields}
})
const { validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? ${config.businessName}AddSchema : ${config.businessName}UpdateSchema,
})
const statusItems = useDictOptions(businessDictCode.enableStatus)
${dictSetup}
${hasStatus ? `const statusValue = computed({
  get: () => String(state.value.status ?? 1),
  set: value => state.value.status = Number(value),
})` : ''}

const formItemUi = {
  root: 'flex items-center',
  label: 'w-24 shrink-0 pr-2 text-right',
  container: 'flex-1',
}

function resetState() {
  Object.assign(state.value, {
    id: '',
${stateFields}
  })
}

watch(visible, (value) => {
  if (!value) return
  resetState()
  if (props.operateType === 'edit' && props.data) {
    Object.assign(state.value, props.data)
  }
})

const handleSubmit = async (_event: FormSubmitEvent<${config.businessName}AddDTO>) => {
  if (props.operateType === 'add') {
    await $trpc.${config.routerKey}.create.mutate(state.value as ${config.businessName}AddDTO)
    useToastSuccess($ts('common.addSuccess'))
  }
  else {
    await $trpc.${config.routerKey}.update.mutate(state.value as ${config.businessName}UpdateDTO)
    useToastSuccess($ts('common.modifySuccess'))
  }
  props.close?.()
  props.refresh?.()
}

const title = computed(() => props.operateType === 'add'
  ? $ts('${config.i18nKey}.add${config.businessName}')
  : $ts('${config.i18nKey}.edit${config.businessName}'))
</script>

<template>
  <UModal v-model:open="visible" :title="title" :dismissible="false" :ui="{ content: 'max-w-[720px]', footer: 'justify-end' }">
    <template #body>
      <UForm id="${config.componentPrefix}-form" :validate="validate" :state="state" class="p-2" @submit="handleSubmit">
        <div class="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
${fields}
        </div>
      </UForm>
    </template>
    <template #footer>
      <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" @click="visible = false" />
      <UButton :label="$ts('common.confirm')" color="primary" type="submit" form="${config.componentPrefix}-form" />
    </template>
  </UModal>
</template>
`
    return { path: `${config.pageDir}/components/${config.componentPrefix}-operate.vue`, content, language: 'vue' }
}

function buildI18n(config: TableConfig, locale: 'zh' | 'en') {
    const title = config.tableComment
    const labels: Record<string, string> = {}
    const form: Record<string, string> = {}

    for (const column of config.columns) {
        labels[property(column)] = comment(column)
        form[property(column)] = locale === 'zh' ? `请输入${comment(column)}` : `Please enter ${comment(column)}`
    }

    const tree: Record<string, any> = {}
    const segments = config.i18nKey.split('.')
    let cursor = tree
    for (const segment of segments.slice(0, -1)) {
        cursor[segment] ??= {}
        cursor = cursor[segment]
    }
    cursor[segments.at(-1)!] = {
        title,
        ...labels,
        form,
        [`add${config.businessName}`]: locale === 'zh' ? `新增${title}` : `Add ${title}`,
        [`edit${config.businessName}`]: locale === 'zh' ? `编辑${title}` : `Edit ${title}`,
    }

    return JSON.stringify(tree, null, 2)
}

function buildMenuSql(config: TableConfig) {
    const path = `/${config.pageDir.replace(/^app\/pages\//, '')}`
    const component = `${config.moduleName}/index`
    const pageCode = config.resourceCode
    const title = config.tableComment.replace(/'/g, "''")
    return `-- 代码生成菜单：执行前把 <MENU_ID>/<ADD_ID>/<EDIT_ID>/<DEL_ID> 替换为实际 UUID
INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
VALUES
  ('<MENU_ID>', '${config.menuParentId}', '${title}', '${pageCode}', 1, '${path}', '${component}', 'i-lucide-table', 100, 0, 1, '${title}', NULL, NULL, 0);

INSERT INTO sys_menu
  (id, parent_id, name, code, type, path, component, icon, sort_order, visible, status, remark, created_by, updated_by, is_deleted)
VALUES
  ('<ADD_ID>', '<MENU_ID>', '${title}新增', '${pageCode}:add', 2, NULL, NULL, NULL, 1, 1, 1, '${title}新增权限', NULL, NULL, 0),
  ('<EDIT_ID>', '<MENU_ID>', '${title}编辑', '${pageCode}:edit', 2, NULL, NULL, NULL, 2, 1, 1, '${title}编辑权限', NULL, NULL, 0),
  ('<DEL_ID>', '<MENU_ID>', '${title}删除', '${pageCode}:del', 2, NULL, NULL, NULL, 3, 1, 1, '${title}删除权限', NULL, NULL, 0);
`
}

export function generateFiles(tableConfig: TableConfig): GenFile[] {
    const config = tableConfig
    const files: GenFile[] = [
        buildSchema(config),
        buildCommon(config),
        buildInput(config),
        buildOutput(config),
        buildSharedIndex(config),
        buildRepo(config),
        buildService(config),
        buildRouter(config),
        buildPage(config),
        buildSearch(config),
        buildOperate(config),
        {
            path: 'app/locales/zh.snippet.json',
            content: buildI18n(config, 'zh'),
            language: 'json',
        },
        {
            path: 'app/locales/en.snippet.json',
            content: buildI18n(config, 'en'),
            language: 'json',
        },
        {
            path: 'sql/menu.sql',
            content: buildMenuSql(config),
            language: 'sql',
        },
        {
            path: 'server/drizzle/schema/index.ts.patch.md',
            content: `# 追加到 server/drizzle/schema/index.ts\n\n\`\`\`ts\nimport { ${config.schemaVar} } from "./${config.schemaPath.replace('server/drizzle/schema/', '').replace(/\.ts$/, '').replace(/\/index$/, '')}"\n\`\`\`\n\n并在 export 列表中加入 \`${config.schemaVar}\`。\n`,
            language: 'markdown',
        },
        {
            path: 'server/trpc/routers.ts.patch.md',
            content: `# 追加到 server/trpc/routers.ts\n\n\`\`\`ts\nimport { ${config.routerKey}Router } from '#admin/${config.routerDir}'\n\`\`\`\n\n并在 \`appRouter\` 中加入：\n\n\`\`\`ts\n${config.routerKey}: ${config.routerKey}Router,\n\`\`\`\n`,
            language: 'markdown',
        },
        {
            path: 'README.md',
            content: buildReadme(config),
            language: 'markdown',
        },
    ]

    return files
}

function buildReadme(config: TableConfig) {
    return `# ${config.tableComment}（${config.tableName}）代码生成结果

## 文件放置

把 \`server/\`、\`shared/\`、\`app/\` 下文件复制到 \`packages/admin-core\` 对应目录。

## 注册

1. 按 \`server/drizzle/schema/index.ts.patch.md\` 导出新表；
2. 按 \`server/trpc/routers.ts.patch.md\` 注册路由；
3. 执行 \`sql/menu.sql\`（先替换 4 个菜单 UUID 占位符）。

## 合并 i18n

把 \`app/locales/zh.snippet.json\`、\`en.snippet.json\` 的内容合并到 \`app/locales/zh.json\`、\`en.json\`。

## 自检

- \`pnpm typecheck\` 通过；
- 页面菜单、按钮权限、接口权限码一致；
- 列表/搜索/表单字段与列配置一致；
- 生成代码中的 \`${config.resourceCode}\` 权限码已在菜单 SQL 中配置。
`
}
