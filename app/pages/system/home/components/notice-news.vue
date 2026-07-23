<script setup lang="ts">
import type { SysNoticeDto } from '#shared/system/notice'

interface NoticeItem {
  id: string
  title: string
  summary: string
  content: string
  contentFormat: string
  time: string
}

const { $trpc } = useNuxtApp()

const notices = ref<SysNoticeDto[]>([])
const loading = ref(false)
const detailVisible = ref(false)
const selectedNotice = ref<NoticeItem | null>(null)

const noticeItems = computed<NoticeItem[]>(() => notices.value.map(notice => ({
  id: notice.id || '',
  title: notice.title || '',
  summary: notice.summary || '',
  content: notice.content || '',
  contentFormat: notice.contentFormat || 'html',
  time: notice.publishTime || notice.createdAt || ''
})))

const loadNotices = async () => {
  loading.value = true
  try {
    notices.value = await $trpc.sysNotice.latest.query({ limit: 10 })
  } finally {
    loading.value = false
  }
}

const openDetail = (item: NoticeItem) => {
  selectedNotice.value = item
  detailVisible.value = true
}

onMounted(() => {
  loadNotices()
})
</script>

<template>
  <UCard
    borderless
    size="sm"
    class="flex min-h-[500px] w-full flex-col"
    :ui="{ body: 'flex min-h-0 flex-1 p-0 sm:p-0' }"
  >
    <template #header>
      <div class="flex items-center justify-between">
        <span>{{ $ts('module.system.notice.title') }}</span>
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="ghost"
          size="xs"
          square
          :loading="loading"
          @click="loadNotices"
        />
      </div>
    </template>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
      <div v-if="loading" class="flex h-full items-center justify-center gap-2 text-sm text-muted">
        <UIcon name="i-lucide-loader-circle" class="animate-spin" />
        <span>{{ $ts('common.loading') }}</span>
      </div>

      <div v-else-if="noticeItems.length === 0" class="flex h-full items-center justify-center text-sm text-muted">
        {{ $ts('common.noData') }}
      </div>

      <template v-else>
        <div
          v-for="item in noticeItems"
          :key="item.id"
          class="flex gap-3 border-b border-default py-4 first:pt-3 last:border-b-0"
        >
          <img
            src="@/assets/imgs/soybean.jpg"
            alt="用户头像"
            class="size-12 shrink-0 rounded-full object-cover"
          >

          <button
            type="button"
            class="min-w-0 flex-1 cursor-pointer pt-1 text-left"
            @click="openDetail(item)"
          >
            <div class="line-clamp-1 text-base font-medium leading-6 text-default">{{ item.title }}</div>
            <div v-if="item.summary" class="mt-1 line-clamp-2 text-sm leading-5 text-muted">{{ item.summary }}</div>
            <div class="mt-1 text-sm font-medium leading-5 text-muted">{{ item.time }}</div>
          </button>
        </div>
      </template>
    </div>
  </UCard>

  <UModal
    v-model:open="detailVisible"
    :title="selectedNotice?.title || String($ts('module.system.notice.noticeTitle'))"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[760px] overflow-hidden', body: 'p-4 sm:p-6' }"
  >
    <template #body>
      <div class="max-h-[min(70vh,620px)] overflow-y-auto">
        <div class="mb-4 flex items-center gap-3 text-sm text-muted">
          <img src="@/assets/imgs/soybean.jpg" alt="用户头像" class="size-10 rounded-full object-cover">
          <div class="min-w-0">
            <div class="truncate font-medium text-default">{{ selectedNotice?.title }}</div>
            <div>{{ selectedNotice?.time }}</div>
          </div>
        </div>

        <p v-if="selectedNotice?.summary" class="mb-4 rounded-md bg-elevated p-3 text-sm text-muted">
          {{ selectedNotice.summary }}
        </p>

        <div
          v-if="selectedNotice?.content && selectedNotice.contentFormat === 'html'"
          class="notice-content text-sm leading-7 text-default"
          v-html="selectedNotice.content"
        />
        <pre v-else-if="selectedNotice?.content" class="whitespace-pre-wrap rounded-md bg-elevated p-3 text-sm leading-7 text-default">{{ selectedNotice.content }}</pre>
        <div v-else class="py-8 text-center text-sm text-muted">
          {{ $ts('common.noData') }}
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.custom-scrollbar {
  scrollbar-color: transparent transparent;
  scrollbar-width: thin;
}

.custom-scrollbar:hover {
  scrollbar-color: rgb(0 0 0 / 0.2) transparent;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: transparent;
  border: 2px solid transparent;
  border-radius: 4px;
  background-clip: padding-box;
}

.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: rgb(0 0 0 / 0.2);
  background-clip: padding-box;
}

.custom-scrollbar:hover::-webkit-scrollbar-thumb:hover {
  background-color: rgb(0 0 0 / 0.3);
}

.notice-content :deep(p) {
  margin-bottom: 0.75rem;
}

.notice-content :deep(img) {
  max-width: 100%;
  border-radius: 0.375rem;
}
</style>
