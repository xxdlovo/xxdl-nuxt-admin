<template>
  <div class="space-y-2">
    <p v-if="entries.length === 0" class="text-xs text-muted">
      {{ $ts('module.system.openapi.noFields') }}
    </p>

    <div
      v-for="entry in entries"
      :key="entry.name"
      class="overflow-hidden rounded-md border border-gray-200 dark:border-gray-800"
      :data-field-name="entry.name"
      :data-field-required="entry.required ? 'true' : 'false'"
    >
      <div class="flex flex-wrap items-center gap-2 bg-elevated/30 px-3 py-1.5">
        <UCheckbox
          :model-value="isIncluded(entry.name)"
          size="sm"
          @update:model-value="value => setIncluded(entry, Boolean(value))"
        />
        <span class="font-mono text-sm text-default">{{ entry.name }}</span>
        <UBadge :label="entry.typeLabel" color="neutral" variant="soft" size="xs" />
        <UBadge
          v-if="entry.required"
          :label="$ts('module.system.openapi.required')"
          color="error"
          variant="soft"
          size="xs"
        />
        <UBadge
          v-else-if="entry.hasDefault"
          :label="$ts('module.system.openapi.hasDefault')"
          color="info"
          variant="soft"
          size="xs"
        />
        <span v-if="entry.description" class="ml-auto truncate text-xs text-muted">{{ entry.description }}</span>
      </div>

      <div v-if="isIncluded(entry.name)" class="border-t border-gray-200 px-3 py-2 dark:border-gray-800">
        <!-- 嵌套对象：递归展开子字段 -->
        <OpenapiFieldForm
          v-if="entry.kind === 'nested'"
          :schema="entry.schema"
          :model-value="nestedValue(entry.name)"
          :depth="currentDepth + 1"
          @update:model-value="value => updateValue(entry.name, value)"
        />

        <!-- 枚举 -->
        <USelect
          v-else-if="entry.kind === 'enum'"
          :model-value="selectValue(entry.name)"
          :items="entry.options"
          size="sm"
          class="w-full"
          @update:model-value="value => updateValue(entry.name, value)"
        />

        <!-- 布尔 -->
        <USwitch
          v-else-if="entry.kind === 'boolean'"
          :model-value="Boolean(valueOf(entry.name))"
          @update:model-value="value => updateValue(entry.name, value)"
        />

        <!-- 数字 -->
        <UInput
          v-else-if="entry.kind === 'number'"
          :model-value="numberValue(entry.name)"
          type="number"
          size="sm"
          class="w-full"
          @update:model-value="value => updateValue(entry.name, toNumber(value))"
        />

        <!-- 字符串 -->
        <UInput
          v-else-if="entry.kind === 'string'"
          :model-value="String(valueOf(entry.name) ?? '')"
          size="sm"
          class="w-full"
          :placeholder="entry.schema.format === 'date-time' ? '2025-01-01T00:00:00.000Z' : ''"
          @update:model-value="value => updateValue(entry.name, value)"
        />

        <!-- 数组 / 自由对象：JSON 文本 -->
        <div v-else class="space-y-1">
          <UTextarea
            :model-value="draftOf(entry.name)"
            :rows="2"
            size="sm"
            class="w-full font-mono"
            placeholder="[]"
            @update:model-value="value => updateDraft(entry.name, String(value))"
          />
          <p v-if="draftError[entry.name]" class="text-xs text-error">
            {{ $ts('module.system.openapi.invalidJson') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { jsonClone } from '#shared/utils/klona'

import { initialFieldValue, type JsonSchema } from '../useOpenapiFields'

/**
 * 根据 OpenAPI 的 properties 渲染「字段多选 + 值编辑」表单。
 *
 * - 勾选决定该字段是否出现在最终入参 JSON 里（未勾选的字段完全不下发，
 *   因此带 .default() 的字段由服务端 zod 补默认值）；
 * - 初始勾选由调用方决定（见 initialValueFromSchema：必填 + 有默认值的字段）；
 * - object 且带 properties 的字段递归展开，数组与自由对象用 JSON 文本编辑。
 */
type FieldEntry = {
    name: string
    schema: JsonSchema
    required: boolean
    hasDefault: boolean
    description?: string
    typeLabel: string
    kind: 'nested' | 'enum' | 'boolean' | 'number' | 'string' | 'json'
    options: { label: string; value: string | number | boolean }[]
}

const MAX_DEPTH = 3

const props = defineProps<{
    schema?: JsonSchema
    modelValue: Record<string, unknown> | undefined
    depth?: number
}>()

const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>()

const { $ts } = useI18n()

const currentDepth = computed(() => props.depth ?? 0)
const value = computed<Record<string, unknown>>(() => props.modelValue ?? {})

/** 复杂类型（数组 / 自由对象）的文本草稿，解析成功才写入 modelValue。 */
const drafts = ref<Record<string, string>>({})
const draftError = ref<Record<string, boolean>>({})

function describeType(schema: JsonSchema): string {
    const type = schema.type ?? (schema.properties ? 'object' : undefined)
    if (type === 'array') {
        const itemType = schema.items?.type ?? 'any'
        return `array<${itemType}>`
    }
    return type ? String(type) : 'any'
}

function resolveKind(schema: JsonSchema): FieldEntry['kind'] {
    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
        return 'enum'
    }

    const type = schema.type

    if (type === 'boolean') {
        return 'boolean'
    }

    if (type === 'integer' || type === 'number') {
        return 'number'
    }

    if (type === 'string') {
        return 'string'
    }

    if (type === 'object' && schema.properties && currentDepth.value < MAX_DEPTH) {
        return 'nested'
    }

    return 'json'
}

const entries = computed<FieldEntry[]>(() => {
    const required = new Set<string>(props.schema?.required ?? [])

    return Object.entries(props.schema?.properties ?? {}).map(([name, raw]) => {
        const schema = (raw ?? {}) as JsonSchema
        const enumValues = Array.isArray(schema.enum)
            ? schema.enum.filter((item: unknown) => ['string', 'number', 'boolean'].includes(typeof item))
            : []

        return {
            name,
            schema,
            required: required.has(name),
            hasDefault: 'default' in schema,
            description: typeof schema.description === 'string' ? schema.description : undefined,
            typeLabel: describeType(schema),
            kind: resolveKind(schema),
            options: enumValues.map((item: string | number | boolean) => ({ label: String(item), value: item }))
        }
    })
})

function isIncluded(name: string) {
    return Object.prototype.hasOwnProperty.call(value.value, name)
}

function valueOf(name: string) {
    return value.value[name]
}

/** 供 USelect 使用：把 unknown 收窄成 AcceptableValue。 */
function selectValue(name: string) {
    const current = value.value[name]

    if (typeof current === 'string' || typeof current === 'number' || typeof current === 'boolean') {
        return current
    }

    return undefined
}

/** 供 UInput（数字）使用。 */
function numberValue(name: string) {
    const current = Number(value.value[name])
    return Number.isFinite(current) ? current : 0
}

function nestedValue(name: string): Record<string, unknown> | undefined {
    const current = value.value[name]
    return current && typeof current === 'object' && !Array.isArray(current)
        ? current as Record<string, unknown>
        : undefined
}

function toNumber(input: unknown) {
    const parsed = Number(input)
    return Number.isFinite(parsed) ? parsed : 0
}

function emitValue(next: Record<string, unknown>) {
    emit('update:modelValue', next)
}

function setIncluded(entry: FieldEntry, included: boolean) {
    const next = { ...value.value }

    if (included) {
        next[entry.name] = initialFieldValue(entry.schema, currentDepth.value + 1)

        if (entry.kind === 'json') {
            drafts.value[entry.name] = JSON.stringify(next[entry.name])
            draftError.value[entry.name] = false
        }
    }
    else {
        delete next[entry.name]
        delete drafts.value[entry.name]
        delete draftError.value[entry.name]
    }

    emitValue(next)
}

function updateValue(name: string, next: unknown) {
    emitValue({ ...value.value, [name]: next })
}

function draftOf(name: string) {
    if (drafts.value[name] !== undefined) {
        return drafts.value[name]
    }

    const raw = value.value[name]
    return raw === undefined ? '' : JSON.stringify(raw)
}

function updateDraft(name: string, text: string) {
    drafts.value[name] = text

    try {
        const parsed = JSON.parse(text)
        draftError.value[name] = false
        updateValue(name, parsed)
    }
    catch {
        // 允许编辑过程中出现非法 JSON，只有解析成功时才写回真实入参
        draftError.value[name] = true
    }
}
</script>
