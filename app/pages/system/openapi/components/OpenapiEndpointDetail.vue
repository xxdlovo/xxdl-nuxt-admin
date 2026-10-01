<template>
  <div class="flex h-full min-h-0 flex-col">
    <!-- 接口头部 -->
    <div class="shrink-0 space-y-2 border-b border-gray-200 p-3 dark:border-gray-800">
      <div class="flex flex-wrap items-center gap-2">
        <UBadge
          :label="endpoint.method.toUpperCase()"
          :color="methodColor"
          variant="soft"
          size="sm"
          class="font-mono"
        />
        <CopyValueBadge
          :label="$ts('module.system.openapi.path')"
          :value="endpoint.path"
          icon="i-lucide-link"
          color="neutral"
        />
        <UBadge
          v-if="endpoint.permission"
          :label="endpoint.permission"
          color="warning"
          variant="soft"
          size="xs"
          icon="i-lucide-shield-check"
        />
        <UBadge
          v-if="endpoint.trpcType"
          :label="endpoint.trpcType"
          color="neutral"
          variant="soft"
          size="xs"
        />
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <h3 class="text-sm font-medium text-default">{{ endpoint.summary }}</h3>
        <UButton size="xs" variant="link" color="neutral" @click="descriptionOpen = !descriptionOpen">
          {{ descriptionOpen ? $ts('module.system.openapi.hideDescription') : $ts('module.system.openapi.showDescription') }}
        </UButton>
        <UButton
          data-openapi-copy-curl
          size="xs"
          variant="outline"
          color="neutral"
          :icon="curlCopied ? 'i-lucide-check' : 'i-lucide-terminal'"
          @click="copyCurl"
        >
          {{ $ts('module.system.openapi.copyCurl') }}
        </UButton>
      </div>

      <pre
        v-if="descriptionOpen"
        class="max-h-60 overflow-auto rounded-md bg-elevated/40 p-2 text-xs whitespace-pre-wrap text-muted"
      >{{ endpoint.description }}</pre>
    </div>

    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
      <!-- 入参 -->
      <section>
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <span class="text-sm font-medium text-default">{{ $ts('module.system.openapi.parameters') }}</span>

          <template v-if="isFieldObject">
            <UButton size="xs" variant="outline" color="neutral" @click="selectRequired">
              {{ $ts('module.system.openapi.selectRequired') }}
            </UButton>
            <UButton size="xs" variant="outline" color="neutral" @click="selectAll">
              {{ $ts('module.system.openapi.selectAll') }}
            </UButton>
            <UButton size="xs" variant="outline" color="neutral" @click="clearAll">
              {{ $ts('module.system.openapi.clearAll') }}
            </UButton>
          </template>

          <span v-if="selectedCount > 0" class="text-xs text-muted">
            {{ $ts('module.system.openapi.selectedCount', { count: selectedCount }) }}
          </span>
        </div>

        <p v-if="!endpoint.hasInput" class="text-xs text-muted">
          {{ $ts('module.system.openapi.noParameters') }}
        </p>

        <!-- 对象型入参：字段多选 -->
        <OpenapiFieldForm
          v-else-if="isFieldObject"
          v-model="fieldValue"
          :schema="endpoint.inputSchema"
        />

        <!-- 标量 / 数组型入参：直接编辑 JSON -->
        <div v-else class="space-y-1">
          <UTextarea v-model="scalarDraft" :rows="3" size="sm" class="w-full font-mono" />
          <p v-if="scalarError" class="text-xs text-error">
            {{ $ts('module.system.openapi.invalidJson') }}
          </p>
        </div>
      </section>

      <!-- curl 预览：复制出来可直接在终端执行 -->
      <section>
        <div class="mb-1 flex items-center gap-2">
          <span class="text-sm font-medium text-default">{{ $ts('module.system.openapi.curlPreview') }}</span>
          <UButton
            size="xs"
            variant="link"
            color="neutral"
            :icon="curlCopied ? 'i-lucide-check' : 'i-lucide-copy'"
            @click="copyCurl"
          >
            {{ $ts('module.system.openapi.copy') }}
          </UButton>
        </div>
        <pre
          data-openapi-curl
          class="max-h-40 overflow-auto rounded-md bg-elevated/40 p-2 text-xs whitespace-pre-wrap text-muted"
        >{{ curlCommand }}</pre>
      </section>

      <!-- 发送 -->
      <div class="flex flex-wrap items-center gap-3">
        <UButton
          data-openapi-send
          :loading="sending"
          icon="i-lucide-send"
          :disabled="Boolean(scalarError)"
          @click="send"
        >
          {{ sending ? $ts('module.system.openapi.sending') : $ts('module.system.openapi.send') }}
        </UButton>

        <template v-if="status !== undefined">
          <UBadge
            data-openapi-status
            :label="`${$ts('module.system.openapi.httpStatus')} ${status}`"
            :color="statusColor"
            variant="soft"
          />
          <span class="text-xs text-muted">{{ $ts('module.system.openapi.duration') }} {{ durationMs }} ms</span>
        </template>
      </div>

      <!-- 响应 -->
      <section v-if="responseText !== undefined">
        <span class="text-sm font-medium text-default">{{ $ts('module.system.openapi.response') }}</span>
        <pre
          data-openapi-response
          class="mt-1 max-h-96 overflow-auto rounded-md bg-elevated/40 p-2 text-xs whitespace-pre-wrap text-muted"
        >{{ responseText }}</pre>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import OpenapiFieldForm from './OpenapiFieldForm.vue'
import CopyValueBadge from '~/components/base/CopyValueBadge.vue'
import { copyToClipboard } from '~/utils/clipboard'
import { useToastSuccess } from '~/utils/toast'
import {
    allFieldsValue,
    initialFieldValue,
    initialValueFromSchema,
    isFieldObjectSchema,
    type OpenApiEndpoint
} from '../useOpenapiFields'

/**
 * 右侧接口详情：字段级入参构造 + 直接发送请求。
 *
 * GET 的入参按 tRPC 协议序列化成 input 查询参数，POST 的入参就是请求体，
 * 两者都由 OpenapiFieldForm 以「勾选字段」的方式构造。
 */
const props = defineProps<{ endpoint: OpenApiEndpoint }>()

const { $ts } = useI18n()

const descriptionOpen = ref(false)
const sending = ref(false)
const curlCopied = ref(false)
let curlCopiedTimer: ReturnType<typeof setTimeout> | null = null
const status = ref<number>()
const durationMs = ref(0)
const responseText = ref<string>()

const fieldValue = ref<Record<string, unknown>>({})
const scalarDraft = ref('')
const scalarError = ref(false)

const isFieldObject = computed(() => isFieldObjectSchema(props.endpoint.inputSchema))
const selectedCount = computed(() => Object.keys(fieldValue.value).length)

const methodColor = computed(() => {
    switch (props.endpoint.method) {
        case 'get': return 'info' as const
        case 'post': return 'primary' as const
        case 'delete': return 'error' as const
        default: return 'warning' as const
    }
})

const statusColor = computed(() => {
    const code = status.value ?? 0

    if (code >= 200 && code < 300) return 'success' as const
    if (code === 0) return 'error' as const
    if (code >= 500) return 'error' as const
    return 'warning' as const
})

/** 当前会真正下发的入参：未勾选的字段不会出现。 */
const payload = computed<unknown>(() => {
    if (!props.endpoint.hasInput) {
        return undefined
    }

    if (isFieldObject.value) {
        return fieldValue.value
    }

    try {
        return JSON.parse(scalarDraft.value)
    }
    catch {
        return undefined
    }
})

const origin = computed(() => import.meta.client ? window.location.origin : '')

/** 单引号包裹并转义内部单引号，保证复制出的命令能直接粘贴到 shell。 */
function shellQuote(text: string) {
    return `'${text.replace(/'/g, `'\\''`)}'`
}

/**
 * 生成等价的 curl 命令（与 server/openapi/buildDocument.ts 里写进 description 的一致）：
 * query 用 GET + --data-urlencode，mutation 用 POST + -d，Cookie 用占位符提示用户替换。
 */
const curlCommand = computed(() => {
    const url = `${origin.value}${props.endpoint.path}`
    const cookie = '-b "nuxt-session=<cookie>"'

    if (!props.endpoint.hasInput || payload.value === undefined) {
        return `curl ${cookie} \\\n  ${url}`
    }

    const json = JSON.stringify(payload.value)

    if (props.endpoint.method === 'get') {
        return [
            'curl -G \\',
            `  ${cookie} \\`,
            `  --data-urlencode input=${shellQuote(json)} \\`,
            `  ${url}`
        ].join('\n')
    }

    return [
        `curl -X ${props.endpoint.method.toUpperCase()} \\`,
        '  -H "content-type: application/json" \\',
        `  ${cookie} \\`,
        `  -d ${shellQuote(json)} \\`,
        `  ${url}`
    ].join('\n')
})

function reset() {
    fieldValue.value = initialValueFromSchema(props.endpoint.inputSchema)
    scalarDraft.value = props.endpoint.hasInput && !isFieldObject.value
        ? JSON.stringify(initialFieldValue(props.endpoint.inputSchema ?? {}))
        : ''
    scalarError.value = false
    descriptionOpen.value = false
    status.value = undefined
    durationMs.value = 0
    responseText.value = undefined
}

// 切换接口时重置入参与响应；key 变化由父级控制，这里只跟随 endpoint 变化
watch(() => props.endpoint.id, reset, { immediate: true })

function selectRequired() {
    fieldValue.value = initialValueFromSchema(props.endpoint.inputSchema)
}

function selectAll() {
    fieldValue.value = allFieldsValue(props.endpoint.inputSchema)
}

function clearAll() {
    fieldValue.value = {}
}

watch(scalarDraft, (text) => {
    if (!props.endpoint.hasInput || isFieldObject.value) {
        return
    }

    try {
        JSON.parse(text)
        scalarError.value = false
    }
    catch {
        // 允许编辑过程中出现非法 JSON
        scalarError.value = text.trim().length > 0
    }
})

function buildRequestUrl() {
    if (props.endpoint.method !== 'get' || payload.value === undefined) {
        return props.endpoint.path
    }

    return `${props.endpoint.path}?input=${encodeURIComponent(JSON.stringify(payload.value))}`
}

function prettyBody(text: string) {
    try {
        return JSON.stringify(JSON.parse(text), null, 2)
    }
    catch {
        return text
    }
}

async function send() {
    sending.value = true
    const startedAt = performance.now()

    try {
        const init: RequestInit = {
            method: props.endpoint.method.toUpperCase(),
            // 同源请求自动携带 nuxt-session Cookie
            credentials: 'same-origin'
        }

        if (props.endpoint.method !== 'get' && payload.value !== undefined) {
            init.headers = { 'content-type': 'application/json' }
            init.body = JSON.stringify(payload.value)
        }

        const response = await fetch(buildRequestUrl(), init)
        const text = await response.text()

        status.value = response.status
        durationMs.value = Math.round(performance.now() - startedAt)
        responseText.value = prettyBody(text)
    }
    catch (error) {
        status.value = 0
        durationMs.value = Math.round(performance.now() - startedAt)
        responseText.value = error instanceof Error ? error.message : String(error)
    }
    finally {
        sending.value = false
    }
}

async function copyCurl() {
    // 复制实现与 CopyValueBadge 共用（含非安全上下文的 textarea 回退）
    const succeeded = await copyToClipboard(curlCommand.value)

    if (!succeeded) {
        return
    }

    curlCopied.value = true
    useToastSuccess($ts('common.copySuccess'))

    if (curlCopiedTimer) {
        clearTimeout(curlCopiedTimer)
    }
    curlCopiedTimer = setTimeout(() => {
        curlCopied.value = false
        curlCopiedTimer = null
    }, 1600)
}

onUnmounted(() => {
    if (curlCopiedTimer) {
        clearTimeout(curlCopiedTimer)
    }
})
</script>
