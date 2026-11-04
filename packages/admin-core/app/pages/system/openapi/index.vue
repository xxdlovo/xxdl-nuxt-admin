<template>
  <div class="flex h-full flex-col gap-3 p-3">
    <UAlert
      v-if="!canList"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      :title="$ts('module.system.openapi.unauthorized')"
    />

    <template v-else>
      <UAlert
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        :title="$ts('module.system.openapi.notice')"
        :description="$ts('module.system.openapi.responseNotice')"
      />

      <UCard class="flex min-h-0 flex-1 flex-col overflow-hidden" :ui="{ body: 'flex h-full flex-col p-0 sm:p-0' }">
        <div class="flex flex-wrap items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-800">
          <span class="text-sm font-medium">{{ $ts('module.system.openapi.title') }}</span>

          <div class="flex rounded-md border border-gray-200 p-0.5 dark:border-gray-700">
            <UButton
              size="xs"
              :variant="view === 'fields' ? 'solid' : 'ghost'"
              :color="view === 'fields' ? 'primary' : 'neutral'"
              @click="view = 'fields'"
            >
              {{ $ts('module.system.openapi.fieldsView') }}
            </UButton>
            <UButton
              size="xs"
              :variant="view === 'swagger' ? 'solid' : 'ghost'"
              :color="view === 'swagger' ? 'primary' : 'neutral'"
              @click="view = 'swagger'"
            >
              {{ $ts('module.system.openapi.swaggerView') }}
            </UButton>
          </div>

          <span v-if="view === 'fields' && endpoints.length > 0" class="text-xs text-muted">
            {{ $ts('module.system.openapi.endpointCount', { count: endpoints.length }) }}
          </span>

          <div class="ml-auto flex items-center gap-2">
            <UButton
              color="neutral"
              variant="outline"
              size="xs"
              icon="i-lucide-refresh-cw"
              :loading="pending"
              @click="refreshDocument"
            >
              {{ $ts('module.system.openapi.refresh') }}
            </UButton>

            <UButton
              color="neutral"
              variant="outline"
              size="xs"
              icon="i-lucide-external-link"
              to="/api/docs"
              target="_blank"
            >
              {{ $ts('module.system.openapi.openInNewTab') }}
            </UButton>
          </div>
        </div>

        <!-- 字段视图：左侧接口树 + 右侧字段级入参构造 -->
        <div v-if="view === 'fields'" class="flex min-h-0 flex-1">
          <div class="w-72 shrink-0 overflow-hidden border-r border-gray-200 dark:border-gray-800">
            <OpenapiEndpointList
              :groups="groups"
              :selected-id="selected?.id"
              @select="selected = $event"
            />
          </div>

          <div class="min-w-0 flex-1 overflow-hidden">
            <div v-if="pending" class="flex h-full items-center justify-center gap-2 text-sm text-muted">
              <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
              {{ $ts('module.system.openapi.loading') }}
            </div>

            <UAlert
              v-else-if="error"
              color="error"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              class="m-3"
              :title="$ts('module.system.openapi.loadFailed')"
              :description="String(error)"
            />

            <OpenapiEndpointDetail
              v-else-if="selected"
              :key="selected.id"
              :endpoint="selected"
            />

            <div v-else class="flex h-full items-center justify-center text-sm text-muted">
              {{ $ts('module.system.openapi.emptySelection') }}
            </div>
          </div>
        </div>

        <!-- Swagger UI：保留完整的规范视图 -->
        <iframe
          v-else
          :key="frameKey"
          src="/api/docs"
          class="h-full w-full flex-1 border-0"
          title="Swagger UI"
        />
      </UCard>
    </template>
  </div>
</template>

<script setup lang="ts">
import OpenapiEndpointDetail from './components/OpenapiEndpointDetail.vue'
import OpenapiEndpointList from './components/OpenapiEndpointList.vue'
import { parseEndpoints, type OpenApiEndpoint } from './useOpenapiFields'

definePageMeta({
  layout: 'system',
  title: 'API 文档',
  icon: 'i-lucide-file-json'
})

const { $ts } = useI18n()
const { canList } = useCrudPermissions('system:openapi')

/** fields：字段级构造器（默认）；swagger：原始 Swagger UI */
const view = ref<'fields' | 'swagger'>('fields')

// 刷新时重建 iframe，因为同源 iframe 内的 Swagger UI 无法从外部触发重新加载
const frameKey = ref(0)

const { data, pending, error, refresh } = await useAsyncData(
  'openapi-document',
  () => $fetch<Record<string, any>>('/api/openapi.json'),
  // 不在这里判断权限：RBAC 数据是异步加载的，setup 阶段 canList 还是 false，
  // 用 immediate: canList.value 会导致文档永远不请求（列表空白）。
  { immediate: false }
)

// 等权限加载完成（或已有权限）后再拉取文档，避免为无权限账号发起必定 401 的请求
watch(canList, (allowed) => {
  if (allowed) {
    void refresh()
  }
}, { immediate: true })

const parsed = computed(() => parseEndpoints(data.value as Record<string, any> | undefined))
const groups = computed(() => parsed.value.groups)
const endpoints = computed(() => parsed.value.endpoints)

const selected = ref<OpenApiEndpoint>()

// 默认选中第一个接口；刷新后原接口不存在时回退到第一个
watch(endpoints, (list) => {
  if (!list.length) {
    selected.value = undefined
    return
  }

  if (!selected.value || !list.some(endpoint => endpoint.id === selected.value?.id)) {
    selected.value = list[0]
  }
}, { immediate: true })

async function refreshDocument() {
  frameKey.value += 1
  await refresh()
}
</script>
