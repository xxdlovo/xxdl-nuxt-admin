<template>
  <div class="h-full flex flex-col p-3 gap-3">
    <UCard class="flex-1 min-h-0 flex flex-col overflow-hidden" :ui="{ body: 'flex flex-col h-full p-0 sm:p-0' }">
      <SplitLayout
        :key="splitLayoutKey"
        :data="dictTypeItems"
        :pagination="dictTypePagination"
        :loading="dictTypeLoading"
        :default-width="340"
        :search-placeholder="$ts('module.system.dictType.form.name')"
        @search="handleDictTypeSearch"
        @page-change="handleDictTypePageChange"
        @page-size-change="handleDictTypePageSizeChange"
        @select="handleDictTypeSelect"
      >
        <template #search-extra>
          <UButton
            icon="i-mdi-refresh"
            size="sm"
            color="neutral"
            variant="outline"
            square
            :loading="dictTypeLoading"
            @click="refreshDictTypes"
          />
          <UButton
            v-permission="dictTypePermissions.codes.add"
            icon="i-ic-round-plus"
            size="sm"
            color="primary"
            variant="outline"
            square
            @click="handleDictTypeAdd"
          />
        </template>

        <template #item="{ item, selected }">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-base font-medium text-(--ui-text-highlighted)">
                {{ item.name }}
              </span>
              <UBadge :color="statusColor(item.status)" variant="subtle" size="sm">
                {{ statusText(item.status) }}
              </UBadge>
            </div>
            <div class="mt-1 flex items-center gap-2 text-xs text-(--ui-text-muted)">
              <span class="truncate">{{ item.code }}</span>
              <span v-if="item.remark" class="truncate">{{ item.remark }}</span>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100" @click.stop>
            <UButton
              v-permission="dictTypePermissions.codes.edit"
              icon="i-ic-round-edit"
              size="xs"
              color="neutral"
              variant="ghost"
              square
              @click="handleDictTypeEdit(String(item.id))"
            />
            <Popconfirm @confirm="handleDictTypeDelete(String(item.id))">
              <template #trigger>
                <UButton
                  v-permission="dictTypePermissions.codes.del"
                  icon="i-ic-round-delete"
                  size="xs"
                  color="error"
                  variant="ghost"
                  square
                />
              </template>
            </Popconfirm>
          </div>
          <UIcon
            v-if="selected"
            name="i-lucide-check"
            class="size-4 shrink-0 text-(--ui-primary)"
          />
        </template>

        <template #content>
          <div class="flex h-full min-w-0 flex-col">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-2 dark:border-gray-800">
              <div class="min-w-0">
                <div class="text-sm font-medium text-(--ui-text-highlighted)">
                  {{ selectedDictType?.name }}
                </div>
                <div class="text-xs text-(--ui-text-muted)">
                  {{ selectedDictType?.code }}
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <UBadge :color="statusColor(selectedDictType?.status)" variant="subtle" size="xl">
                  {{ statusText(selectedDictType?.status) }}
                </UBadge>
              </div>
            </div>

            <div class="flex flex-1 min-h-0 flex-col p-3">
              <SysDictDataPanel :type-id="selectedDictTypeId" />
            </div>
          </div>
        </template>

        <template #empty-content>
          <div class="flex h-full items-center justify-center p-6">
            <UEmpty
              icon="i-lucide-book-open"
              title="请选择字典类型"
              description="从左侧选择一个字典类型后，可以在右侧维护对应的字典数据。"
              variant="naked"
            />
          </div>
        </template>
      </SplitLayout>
    </UCard>

    <SysDictTypeOperate
      v-model:visible="dictTypeDrawerVisible"
      :operate-type="dictTypeOperateType"
      :data="editingDictType ?? undefined"
      :close="closeDictTypeVisible"
      :refresh="refreshDictTypes"
    />
  </div>
</template>

<script setup lang="ts">
import type { SysDictTypeDto, SysDictTypeQueryDTO } from '#shared/system/dictType'
import { ENABLE_STATUS_CONFIG } from '#shared/constants/business'
import SplitLayout from '~/components/SplitLayout.vue'
import SysDictTypeOperate from './components/sys-dict-type-operate.vue'
import SysDictDataPanel from '../dict-data/components/sys-dict-data-panel.vue'
import { useTableOperate } from '~/composables/useTable'
import { useToastSuccess } from '~/utils/toast'

definePageMeta({
  layout: 'system'
})

interface SelectableItem {
  id: string | number
  [key: string]: unknown
}

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const splitLayoutKey = ref(0)
const dictTypePermissions = useCrudPermissions('system:dictType')

const dictTypes = ref<SysDictTypeDto[]>([])
const dictTypeItems = computed(() => {
  return dictTypes.value.filter((item): item is SysDictTypeDto & { id: string } => Boolean(item.id))
})
const dictTypeLoading = ref(false)
const dictTypeSearchParams = ref<SysDictTypeQueryDTO>({})
const dictTypePagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})
const selectedDictType = ref<SysDictTypeDto | null>(null)
const selectedDictTypeId = computed(() => selectedDictType.value?.id || '')

const {
  operateType: dictTypeOperateType,
  editingData: editingDictType,
  drawerVisible: dictTypeDrawerVisible,
  handleAdd: handleDictTypeAdd,
  handleEdit: handleDictTypeEdit,
  closeVisible: closeDictTypeVisible
} = useTableOperate<SysDictTypeDto>({
  data: dictTypes,
  idKey: 'id',
  refresh: async () => {
    await refreshDictTypes()
  }
})

const statusText = (status: unknown) => {
  const normalizedStatus = String(status ?? 1)
  const config = ENABLE_STATUS_CONFIG[normalizedStatus as keyof typeof ENABLE_STATUS_CONFIG]
  return config ? $ts(config.i18nKey) : normalizedStatus
}

const statusColor = (status: unknown) => {
  const normalizedStatus = String(status ?? 1)
  const config = ENABLE_STATUS_CONFIG[normalizedStatus as keyof typeof ENABLE_STATUS_CONFIG]
  return config?.color || 'neutral'
}

const loadDictTypes = async () => {
  dictTypeLoading.value = true
  try {
    const result = await $trpc.sysDictType.page.query({
      page: dictTypePagination.page,
      pageSize: dictTypePagination.pageSize,
      ...dictTypeSearchParams.value
    })
    dictTypes.value = result.list
    dictTypePagination.page = result.page
    dictTypePagination.pageSize = result.pageSize
    dictTypePagination.total = result.total
  } finally {
    dictTypeLoading.value = false
  }
}

const refreshDictTypes = async () => {
  await loadDictTypes()
  const selectedId = selectedDictType.value?.id
  if (selectedId) {
    selectedDictType.value = dictTypes.value.find(item => item.id === selectedId) ?? null
  }
  if (!selectedDictType.value) {
    splitLayoutKey.value += 1
  }
}

const handleDictTypeSearch = async (keyword: string) => {
  dictTypePagination.page = 1
  dictTypeSearchParams.value = {
    name: keyword || undefined
  }
  await loadDictTypes()
}

const handleDictTypePageChange = async (page: number) => {
  dictTypePagination.page = page
  await loadDictTypes()
}

const handleDictTypePageSizeChange = async (pageSize: number) => {
  dictTypePagination.page = 1
  dictTypePagination.pageSize = pageSize
  await loadDictTypes()
}

const handleDictTypeSelect = async (value: SelectableItem | SelectableItem[] | null) => {
  const selected = Array.isArray(value) ? (value[0] ?? null) : value
  selectedDictType.value = selected as SysDictTypeDto | null
}

const handleDictTypeDelete = async (id: string) => {
  if (dictTypeLoading.value) return
  await $trpc.sysDictType.remove.mutate(id)
  useToastSuccess($ts('common.deleteSuccess'))
  if (selectedDictType.value?.id === id) {
    selectedDictType.value = null
    splitLayoutKey.value += 1
  }
  await refreshDictTypes()
}

onMounted(async () => {
  await loadDictTypes()
})
</script>

<style scoped>
:deep(.overflow-auto) {
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 640px) {
  :deep(table) {
    display: table;
    width: 100%;
    min-width: 600px;
  }
}
</style>
