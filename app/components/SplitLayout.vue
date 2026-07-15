<script setup lang="ts">
interface SelectOption {
  label: string
  value: string
}

interface PaginationConfig {
  page: number
  pageSize: number
  total: number
}

interface SelectableItem {
  id: string | number
  [key: string]: unknown
}

type SelectionMode = 'single' | 'multiple'

const props = withDefaults(defineProps<{
  data?: SelectableItem[]
  pagination?: PaginationConfig
  searchPlaceholder?: string
  showPagination?: boolean
  selectionMode?: SelectionMode
  defaultWidth?: number
  collapsible?: boolean
  loading?: boolean
  showDraw?: boolean
}>(), {
  data: () => [],
  pagination: () => ({ page: 1, pageSize: 10, total: 0 }),
  searchPlaceholder: '搜索...',
  showPagination: true,
  selectionMode: 'single',
  defaultWidth: 320,
  collapsible: true,
  loading: false,
  showDraw: true
})

const emit = defineEmits<{
  search: [query: string]
  select: [item: SelectableItem | SelectableItem[] | null]
  pageChange: [page: number]
  pageSizeChange: [size: number]
  widthChange: [width: number]
}>()

// Search
const searchQuery = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined
const debouncedSearch = (query: string) => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(() => {
    emit('search', query)
  }, 300)
}
const submitSearch = (query: string) => {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = undefined
  }
  emit('search', query)
}
const onSearchInput = (value: string | number) => {
  const query = String(value)
  searchQuery.value = query
  debouncedSearch(query)
}
const clearSearch = () => {
  searchQuery.value = ''
  submitSearch('')
}

// Selection
const selectedItem = ref<SelectableItem | null>(null)
const selectedItems = ref<SelectableItem[]>([])

const toggleSelect = (item: SelectableItem) => {
  if (props.selectionMode === 'single') {
    if (selectedItem.value?.id === item.id) {
      selectedItem.value = null
      emit('select', null)
    } else {
      selectedItem.value = item
      emit('select', item)
    }
  } else {
    const index = selectedItems.value.findIndex(s => s.id === item.id)
    if (index > -1) {
      selectedItems.value.splice(index, 1)
    } else {
      selectedItems.value.push(item)
    }
    emit('select', [...selectedItems.value])
  }
}

const isSelected = (item: SelectableItem): boolean => {
  if (props.selectionMode === 'single') {
    return selectedItem.value?.id === item.id
  }
  return selectedItems.value.some(s => s.id === item.id)
}

// Collapse
const collapsed = ref(false)
const toggleCollapse = () => {
  collapsed.value = !collapsed.value
}

// Resize - custom implementation using mouse events
const leftPanelRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const storageKey = 'split-layout-width'
const panelWidth = ref(props.defaultWidth)

onMounted(() => {
  const storedWidth = window.localStorage.getItem(storageKey)
  const parsedWidth = storedWidth ? Number(storedWidth) : NaN
  if (Number.isFinite(parsedWidth)) {
    panelWidth.value = parsedWidth
  }
})

const startResize = (e: MouseEvent) => {
  if (!props.showDraw) return
  e.preventDefault()
  isDragging.value = true
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const onMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return
  const isMd = window.innerWidth >= 768 && window.innerWidth < 1024
  const minWidth = isMd ? 200 : 240
  const maxWidth = isMd ? 400 : 480
  const newWidth = Math.max(minWidth, Math.min(maxWidth, e.clientX))
  panelWidth.value = newWidth
  window.localStorage.setItem(storageKey, String(newWidth))
  emit('widthChange', newWidth)
}

const stopResize = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// Pagination
const onPageChange = (page: number) => {
  emit('pageChange', page)
}

const onPageSizeChange = (size: number) => {
  emit('pageSizeChange', size)
}

// Page size options
const pageSizeOptions: SelectOption[] = [
  { label: '10', value: '10' },
  { label: '20', value: '20' },
  { label: '50', value: '50' },
  { label: '100', value: '100' }
]

const handlePageSizeChange = (value: string) => {
  onPageSizeChange(Number(value))
}

// Keyboard shortcuts
// defineShortcuts({
//   meta_b: {
//     handler: () => { if (props.collapsible) toggleCollapse() },
//     whenever: [() => props.collapsible]
//   }
// })

// Mobile slideover
const mobileListOpen = ref(false)
const openMobileList = () => {
  mobileListOpen.value = true
}

onUnmounted(() => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  stopResize()
})
</script>

<template>
  <!-- Desktop & Tablet: Side-by-side layout -->
    <div class="flex h-full w-full overflow-hidden">
      <!-- Left Panel -->
      <div
        v-show="!collapsed"
        ref="leftPanelRef"
        :style="{
          width: collapsed ? '0px' : `${panelWidth}px`,
          minWidth: collapsed ? '0px' : undefined
        }"
        class="relative hidden flex-col border-r border-(--ui-border) bg-(--ui-bg-elevated)/30 transition-[width] duration-200 lg:flex"
        :class="{
          'overflow-hidden': collapsed,
          'min-w-0': collapsed
        }"
      >
        <!-- Search bar -->
        <div class="flex flex-shrink-0 items-center gap-1 p-3 pr-5">
          <UInput
            :model-value="searchQuery"
            size="sm"
            variant="subtle"
            :placeholder="searchPlaceholder"
            icon="i-lucide-search"
            class="flex-1"
            @update:model-value="onSearchInput"
            @keydown.enter="submitSearch(searchQuery)"
          >
            <template v-if="searchQuery" #trailing>
              <UButton
                icon="i-lucide-x"
                size="xs"
                color="neutral"
                variant="ghost"
                square
                @click="clearSearch"
              />
            </template>
          </UInput>
          <slot name="search-extra" />
        </div>

        <!-- Collapse button -->
        <UButton
          v-if="collapsible"
          :icon="collapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
          size="xs"
          color="neutral"
          variant="soft"
          square
          class="absolute right-0 top-1/2 z-20 translate-x-1/2 -translate-y-1/2 border border-(--ui-border) bg-(--ui-bg) shadow-sm"
          @click="toggleCollapse"
        />

        <div class="mx-3 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-(--ui-border) bg-(--ui-bg)">
          <!-- List area -->
          <UScrollArea class="flex-1">
            <template #default>
              <template v-if="loading">
                <div class="space-y-2 p-3">
                  <USkeleton v-for="i in 5" :key="i" class="h-12 w-full rounded-md" />
                </div>
              </template>
              <template v-else-if="data.length === 0">
                <slot name="empty">
                  <div class="flex flex-col items-center justify-center py-12 text-(--ui-text-muted)">
                    <UIcon name="i-lucide-inbox" class="size-10 mb-2 opacity-40" />
                    <p class="text-sm">暂无数据 | No Data</p>
                  </div>
                </slot>
              </template>
              <div v-else class="divide-y divide-(--ui-border)/50">
                <div
                  v-for="(item, index) in data"
                  :key="item.id"
                  class="group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-l-[3px] border-transparent transition-all duration-150"
                  :class="{
                    'bg-(--ui-bg-elevated)/50 border-l-(--ui-primary)': isSelected(item),
                    'hover:bg-(--ui-bg-elevated)/30': !isSelected(item)
                  }"
                  @click="toggleSelect(item)"
                >
                  <slot name="item" :item="item" :index="index" :selected="isSelected(item)">
                    <span class="truncate text-base flex-1">{{ (item.label as string) || (item.name as string) || item.id }}</span>
                  </slot>
                </div>
              </div>
            </template>
          </UScrollArea>

          <!-- Pagination -->
          <div
            v-if="showPagination && pagination.total > 0"
            class="flex-shrink-0 border-t border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900"
          >
            <div class="flex flex-wrap items-center justify-end gap-2">
              <div class="text-sm text-gray-700 dark:text-gray-300">
                共 {{ pagination.total }} 条
              </div>
              <USelect
                :model-value="String(pagination.pageSize)"
                :items="pageSizeOptions"
                :disabled="loading"
                class="w-16 sm:w-20"
                @update:model-value="handlePageSizeChange"
              />
              <UPagination
                v-if="pagination.total > pagination.pageSize"
                :page="pagination.page"
                :total="pagination.total"
                :items-per-page="pagination.pageSize"
                :disabled="loading"
                :max="5"
                show-first
                show-last
                @update:page="onPageChange"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Resize Handle -->
      <div
        v-if="showDraw && !collapsed"
        class="relative hidden lg:flex w-1.5 cursor-col-resize shrink-0 group"
        :class="{ 'bg-(--ui-primary)/10': isDragging }"
        @mousedown="startResize"
      >
        <div
          class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px] rounded-full transition-colors duration-200 group-hover:bg-(--ui-primary)/40"
          :class="{ 'bg-(--ui-primary)/60': isDragging }"
        />
      </div>

      <!-- Right Panel - Desktop/Tablet -->
      <div class="flex-1 flex flex-col min-w-0 hidden lg:flex">
        <!-- Collapsed sidebar indicator button -->
        <div v-if="collapsible && collapsed" class="absolute left-0 top-1/2 -translate-y-1/2 z-10">
          <UButton
            icon="i-lucide-panel-left-open"
            size="sm"
            color="neutral"
            variant="soft"
            square
            class="shadow-md"
            @click="toggleCollapse"
          />
        </div>
        <slot v-if="selectedItem" name="content" :selected-item="selectedItem">
          <div class="flex items-center justify-center h-full text-(--ui-text-muted) text-sm">
            请选择左侧列表项查看详情
          </div>
        </slot>
        <slot v-else name="empty-content">
          <div class="flex items-center justify-center h-full text-(--ui-text-muted) text-sm">
            请选择左侧列表项查看详情
          </div>
        </slot>
      </div>

      <!-- Mobile Layout -->
      <div class="flex flex-col h-full w-full lg:hidden">
        <!-- Mobile header with list toggle -->
        <div class="flex items-center gap-2 p-2 border-b border-(--ui-border) bg-(--ui-bg)">
          <UButton
            icon="i-lucide-list"
            size="sm"
            color="neutral"
            variant="ghost"
            @click="openMobileList"
          />
          <div class="flex-1 text-sm font-medium truncate">
            {{ selectedItem ? ((selectedItem as Record<string, unknown>).label || (selectedItem as Record<string, unknown>).name || '已选择') : '请选择' }}
          </div>
        </div>

        <!-- Mobile content area -->
        <div class="flex-1 overflow-auto">
          <slot v-if="selectedItem" name="content" :selected-item="selectedItem">
            <div class="flex items-center justify-center h-full text-(--ui-text-muted) text-sm p-4">
              请选择左侧列表项查看详情
            </div>
          </slot>
          <slot v-else name="empty-content">
            <div class="flex items-center justify-center h-full text-(--ui-text-muted) text-sm p-4">
              请选择左侧列表项查看详情
            </div>
          </slot>
        </div>

        <!-- Mobile bottom pagination (simplified) -->
        <div v-if="showPagination && pagination.total > 0" class="flex items-center justify-between p-2 border-t border-(--ui-border) bg-(--ui-bg)">
          <UBadge variant="subtle" color="neutral" size="sm">
            {{ pagination.total }} 条
          </UBadge>
          <div class="flex items-center gap-1">
            <UButton
              icon="i-lucide-chevron-left"
              size="xs"
              color="neutral"
              variant="ghost"
              square
              :disabled="pagination.page <= 1"
              @click="onPageChange(pagination.page - 1)"
            />
            <span class="text-xs text-(--ui-text-muted) px-1">{{ pagination.page }}/{{ Math.ceil(pagination.total / pagination.pageSize) }}</span>
            <UButton
              icon="i-lucide-chevron-right"
              size="xs"
              color="neutral"
              variant="ghost"
              square
              :disabled="pagination.page >= Math.ceil(pagination.total / pagination.pageSize)"
              @click="onPageChange(pagination.page + 1)"
            />
          </div>
        </div>

        <!-- Mobile Slideover for list -->
        <USlideover
          v-model:open="mobileListOpen"
          side="left"
          :ui="{
            content: 'w-[85vw] max-w-[400px]'
          }"
        >
          <template #header>
            <div class="flex items-center gap-2">
              <UInput
                :model-value="searchQuery"
                size="sm"
                variant="subtle"
                :placeholder="searchPlaceholder"
                icon="i-lucide-search"
                class="flex-1"
                @update:model-value="onSearchInput"
                @keydown.enter="submitSearch(searchQuery)"
              >
                <template v-if="searchQuery" #trailing>
                  <UButton
                    icon="i-lucide-x"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    square
                    @click="clearSearch"
                  />
                </template>
              </UInput>
            </div>
          </template>

          <UScrollArea class="flex-1 h-full">
            <template #default>
              <template v-if="loading">
                <div class="space-y-2 p-3">
                  <USkeleton v-for="i in 5" :key="i" class="h-12 w-full rounded-md" />
                </div>
              </template>
              <template v-else-if="data.length === 0">
                <slot name="empty">
                  <div class="flex flex-col items-center justify-center py-12 text-(--ui-text-muted)">
                    <UIcon name="i-lucide-inbox" class="size-10 mb-2 opacity-40" />
                    <p class="text-sm">暂无数据</p>
                  </div>
                </slot>
              </template>
              <div v-else class="divide-y divide-(--ui-border)/50">
                <div
                  v-for="(item, index) in data"
                  :key="item.id"
                  class="group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-l-[3px] border-transparent transition-all duration-150"
                  :class="{
                    'bg-(--ui-bg-elevated)/50 border-l-(--ui-primary)': isSelected(item),
                    'hover:bg-(--ui-bg-elevated)/30': !isSelected(item)
                  }"
                  @click="toggleSelect(item); mobileListOpen = false"
                >
                  <slot name="item" :item="item" :index="index" :selected="isSelected(item)">
                    <span class="truncate text-sm flex-1">{{ (item.label as string) || (item.name as string) || item.id }}</span>
                  </slot>
                </div>
              </div>
            </template>
          </UScrollArea>

          <!-- Mobile slideover pagination -->
          <template v-if="showPagination && pagination.total > 0" #footer>
            <div class="flex items-center justify-between">
              <USelect
                :model-value="String(pagination.pageSize)"
                size="xs"
                variant="subtle"
                :items="pageSizeOptions"
                class="w-20"
                @update:model-value="handlePageSizeChange"
              />
              <div class="flex items-center gap-1">
                <UButton
                  icon="i-lucide-chevron-left"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  square
                  :disabled="pagination.page <= 1"
                  @click="onPageChange(pagination.page - 1)"
                />
                <span class="text-xs text-(--ui-text-muted) px-1">{{ pagination.page }}/{{ Math.ceil(pagination.total / pagination.pageSize) }}</span>
                <UButton
                  icon="i-lucide-chevron-right"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  square
                  :disabled="pagination.page >= Math.ceil(pagination.total / pagination.pageSize)"
                  @click="onPageChange(pagination.page + 1)"
                />
              </div>
            </div>
          </template>
        </USlideover>
      </div>
    </div>
</template>
