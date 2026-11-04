<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="shrink-0 border-b border-gray-200 p-2 dark:border-gray-800">
      <UInput
        v-model="keyword"
        icon="i-lucide-search"
        size="sm"
        class="w-full"
        :placeholder="$ts('module.system.openapi.searchPlaceholder')"
      />
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      <p v-if="filteredGroups.length === 0" class="p-2 text-xs text-muted">
        {{ $ts('module.system.openapi.noMatch') }}
      </p>

      <div v-for="group in filteredGroups" :key="group.tag" class="mb-1">
        <button
          type="button"
          class="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-elevated/60"
          @click="toggleGroup(group.tag)"
        >
          <UIcon
            :name="isExpanded(group.tag) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
            class="size-3.5 shrink-0"
          />
          <span class="truncate">{{ group.tag }}</span>
          <span class="ml-auto shrink-0 text-[10px]">{{ group.endpoints.length }}</span>
        </button>

        <ul v-show="isExpanded(group.tag)" class="mt-0.5 space-y-0.5">
          <li v-for="endpoint in group.endpoints" :key="endpoint.id">
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors"
              :class="endpoint.id === selectedId
                ? 'bg-primary/10 text-primary'
                : 'text-default hover:bg-elevated/60'"
              :data-endpoint-id="endpoint.id"
              @click="emit('select', endpoint)"
            >
              <span
                class="w-11 shrink-0 rounded px-1 py-0.5 text-center font-mono text-[10px] font-semibold uppercase"
                :class="methodClass(endpoint.method)"
              >
                {{ endpoint.method }}
              </span>
              <span class="min-w-0 flex-1 truncate font-mono">
                {{ endpoint.trpcPath ?? endpoint.path }}
              </span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { OpenApiEndpoint, OpenApiEndpointGroup } from '../useOpenapiFields'

/**
 * 左侧接口树：按 tag（tRPC 路由命名空间）分组，支持关键字过滤。
 * 折叠状态由本组件维护，避免父级为每个分组维护状态。
 */
const props = defineProps<{
    groups: OpenApiEndpointGroup[]
    selectedId?: string
}>()

const emit = defineEmits<{ select: [endpoint: OpenApiEndpoint] }>()

const { $ts } = useI18n()

const keyword = ref('')
const collapsed = ref<string[]>([])

const METHOD_CLASS: Record<string, string> = {
    get: 'bg-info/15 text-info',
    post: 'bg-primary/15 text-primary',
    put: 'bg-warning/15 text-warning',
    patch: 'bg-warning/15 text-warning',
    delete: 'bg-error/15 text-error'
}

function methodClass(method: string) {
    return METHOD_CLASS[method] ?? 'bg-elevated text-muted'
}

function toggleGroup(tag: string) {
    collapsed.value = collapsed.value.includes(tag)
        ? collapsed.value.filter(item => item !== tag)
        : [...collapsed.value, tag]
}

function isExpanded(tag: string) {
    // 搜索时始终展开，便于直接看到命中结果
    return keyword.value.length > 0 || !collapsed.value.includes(tag)
}

const filteredGroups = computed(() => {
    const needle = keyword.value.trim().toLowerCase()

    if (!needle) {
        return props.groups
    }

    return props.groups
        .map(group => ({
            tag: group.tag,
            endpoints: group.endpoints.filter(endpoint =>
                endpoint.path.toLowerCase().includes(needle)
                || endpoint.trpcPath?.toLowerCase().includes(needle)
                || endpoint.summary.toLowerCase().includes(needle)
            )
        }))
        .filter(group => group.endpoints.length > 0)
})
</script>
