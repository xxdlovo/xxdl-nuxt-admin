<script setup lang="ts">
import SplitLayout from '@/components/SplitLayout.vue'

definePageMeta({
  layout: 'system'
})

interface DemoProject {
  id: number
  label: string
  name: string
  owner: string
  status: '进行中' | '已完成' | '待评审' | '已暂停'
  priority: '高' | '中' | '低'
  progress: number
  updatedAt: string
  description: string
}

interface SelectableItem {
  id: string | number
  [key: string]: unknown
}

const statuses: DemoProject['status'][] = ['进行中', '已完成', '待评审', '已暂停']
const priorities: DemoProject['priority'][] = ['高', '中', '低']
const owners = ['张晨', '李想', '王宁', '赵一鸣', '陈鹿']

const projects = ref<DemoProject[]>(
  Array.from({ length: 36 }, (_, index) => {
    const id = index + 1
    const status = statuses[index % statuses.length]!
    const priority = priorities[index % priorities.length]!

    return {
      id,
      label: `演示项目 ${String(id).padStart(2, '0')}`,
      name: `Split Layout 场景 ${id}`,
      owner: owners[index % owners.length]!,
      status,
      priority,
      progress: Math.min(100, 18 + ((index * 13) % 83)),
      updatedAt: `2026-07-${String((index % 15) + 1).padStart(2, '0')}`,
      description: '这是一条用于验证分栏布局、搜索、分页和详情展示的模拟数据。'
    }
  })
)

const query = ref('')
const page = ref(1)
const pageSize = ref(10)
const selectedProject = ref<DemoProject | null>(null)

const filteredProjects = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) {
    return projects.value
  }

  return projects.value.filter(item => {
    return [item.label, item.name, item.owner, item.status, item.priority]
      .some(value => value.toLowerCase().includes(keyword))
  })
})

const pagedProjects = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredProjects.value.slice(start, start + pageSize.value)
})

const pagination = computed(() => ({
  page: page.value,
  pageSize: pageSize.value,
  total: filteredProjects.value.length
}))

const handleSearch = (value: string) => {
  query.value = value
  page.value = 1
}

const handlePageChange = (value: number) => {
  page.value = value
}

const handlePageSizeChange = (value: number) => {
  pageSize.value = value
  page.value = 1
}

const handleSelect = (value: SelectableItem | SelectableItem[] | null) => {
  selectedProject.value = (Array.isArray(value) ? (value[0] ?? null) : value) as DemoProject | null
}

const statusColor = (status: unknown) => {
  const map = {
    '进行中': 'primary',
    '已完成': 'success',
    '待评审': 'warning',
    '已暂停': 'neutral'
  } as const

  return typeof status === 'string' && status in map
    ? map[status as DemoProject['status']]
    : 'neutral'
}

const priorityColor = (priority: unknown) => {
  const map = {
    '高': 'error',
    '中': 'warning',
    '低': 'neutral'
  } as const

  return typeof priority === 'string' && priority in map
    ? map[priority as DemoProject['priority']]
    : 'neutral'
}
</script>

<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <UCard class="flex-1 min-h-0 flex flex-col overflow-hidden" :ui="{ body: 'flex flex-col h-full p-0 sm:p-0' }">
      <SplitLayout
        :data="pagedProjects"
        :pagination="pagination"
        search-placeholder="搜索项目、负责人或状态"
        @search="handleSearch"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
        @select="handleSelect"
      >
        <template #search-extra>
          <UBadge color="neutral" variant="subtle" size="sm">
            {{ filteredProjects.length }}
          </UBadge>
        </template>

        <template #item="{ item, selected }">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-medium text-(--ui-text-highlighted)">
                {{ item.label }}
              </span>
              <UBadge :color="statusColor(item.status)" variant="subtle" size="xs">
                {{ item.status }}
              </UBadge>
            </div>
            <div class="mt-1 flex items-center gap-2 text-xs text-(--ui-text-muted)">
              <span class="truncate">{{ item.owner }}</span>
              <span class="h-1 w-1 rounded-full bg-(--ui-border-accented)" />
              <span>{{ item.updatedAt }}</span>
            </div>
          </div>
          <UIcon
            v-if="selected"
            name="i-lucide-check"
            class="size-4 shrink-0 text-(--ui-primary)"
          />
        </template>

        <template #content="{ selectedItem }">
          <div class="flex h-full flex-col overflow-hidden bg-(--ui-bg)">
            <div class="flex flex-wrap items-start justify-between gap-3 border-b border-(--ui-border) px-4 py-3">
              <div class="min-w-0">
                <div class="mb-1 flex items-center gap-2 text-xs text-(--ui-text-muted)">
                  <span>#{{ selectedItem.id }}</span>
                  <span>{{ selectedItem.updatedAt }}</span>
                </div>
                <h1 class="truncate text-base font-semibold text-(--ui-text-highlighted)">
                  {{ selectedItem.name }}
                </h1>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <UBadge :color="statusColor(selectedItem.status)" variant="subtle">
                  {{ selectedItem.status }}
                </UBadge>
                <UBadge :color="priorityColor(selectedItem.priority)" variant="subtle">
                  {{ selectedItem.priority }}优先级
                </UBadge>
              </div>
            </div>

            <div class="flex-1 overflow-auto p-4">
              <div class="space-y-4">
                <div class="rounded-md border border-(--ui-border) bg-(--ui-bg) p-4">
                  <div class="mb-3 text-sm font-medium text-(--ui-text-highlighted)">基本信息</div>
                  <dl class="grid gap-4 md:grid-cols-3">
                    <div>
                      <dt class="text-xs text-(--ui-text-muted)">负责人</dt>
                      <dd class="mt-1 text-sm font-medium">{{ selectedItem.owner }}</dd>
                    </div>
                    <div>
                      <dt class="text-xs text-(--ui-text-muted)">最近更新</dt>
                      <dd class="mt-1 text-sm font-medium">{{ selectedItem.updatedAt }}</dd>
                    </div>
                    <div>
                      <dt class="text-xs text-(--ui-text-muted)">完成进度</dt>
                      <dd class="mt-1 text-sm font-medium">{{ selectedItem.progress }}%</dd>
                    </div>
                  </dl>
                </div>

                <div class="rounded-md border border-(--ui-border) bg-(--ui-bg) p-4">
                  <div class="mb-3 flex items-center justify-between">
                    <span class="text-sm font-medium text-(--ui-text-highlighted)">项目进度</span>
                    <span class="text-sm text-(--ui-text-muted)">{{ selectedItem.progress }}%</span>
                  </div>
                  <UProgress :model-value="Number(selectedItem.progress)" />
                </div>

                <div class="rounded-md border border-(--ui-border) bg-(--ui-bg) p-4">
                  <div class="mb-2 text-sm font-medium text-(--ui-text-highlighted)">备注</div>
                  <p class="text-sm leading-6 text-(--ui-text-muted)">
                    {{ selectedItem.description }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template #empty-content>
          <div class="flex h-full items-center justify-center p-6 text-sm text-(--ui-text-muted)">
            从左侧选择一个项目查看详情
          </div>
        </template>
      </SplitLayout>
    </UCard>
  </div>
</template>
