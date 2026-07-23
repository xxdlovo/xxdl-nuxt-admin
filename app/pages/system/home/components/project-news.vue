<script setup lang="ts">
const { $t } = useI18n()

interface NewsItem {
  id: number
  content: string
  time: string
}

const newses = computed<NewsItem[]>(() => [
  { id: 1, content: $t('page.home.projectNews.desc1') as string, time: '2021-05-28 22:22:22' },
  { id: 2, content: $t('page.home.projectNews.desc2') as string, time: '2021-10-27 10:24:54' },
  { id: 3, content: $t('page.home.projectNews.desc3') as string, time: '2021-10-31 22:43:12' },
  { id: 4, content: $t('page.home.projectNews.desc4') as string, time: '2021-11-03 20:33:31' },
  { id: 5, content: $t('page.home.projectNews.desc5') as string, time: '2021-11-07 22:45:32' },
  { id: 6, content: $t('page.home.projectNews.desc5') as string, time: '2021-11-07 22:45:32' },
  { id: 7, content: $t('page.home.projectNews.desc5') as string, time: '2021-11-07 22:45:32' },
  { id: 8, content: $t('page.home.projectNews.desc5') as string, time: '2021-11-07 22:45:32' },
  { id: 9, content: $t('page.home.projectNews.desc5') as string, time: '2021-11-07 22:45:32' },
  { id: 10, content: $t('page.home.projectNews.desc5') as string, time: '2021-11-07 22:45:32' }
])

function moreNewsHandle() {
  console.log('moreNewsHandle')
}
</script>

<template>
  <UCard
    :title="String($t('page.home.creativity'))"
    borderless
    size="sm"
    class="flex min-h-[500px] w-full flex-col"
    :ui="{ body: 'flex min-h-0 flex-1 p-0 sm:p-0' }"
  >
    <template #header>
      <div class="flex items-center justify-between">
        <span>{{ $t('page.home.projectNews.title') }}</span>
        <ULink class="text-primary hover:text-primary" @click="moreNewsHandle">
          {{ $t('page.home.projectNews.moreNews') }}
        </ULink>
      </div>
    </template>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
      <div
        v-for="item in newses"
        :key="item.id"
        class="flex gap-3 border-b border-default py-4 first:pt-3 last:border-b-0"
      >
        <img
          src="@/assets/imgs/soybean.jpg"
          alt="用户头像"
          class="size-12 shrink-0 rounded-full object-cover"
        >

        <div class="min-w-0 flex-1 pt-1">
          <div class="text-base font-medium leading-6 text-highlighted">{{ item.content }}</div>
          <div class="mt-1 text-sm font-medium leading-5 text-default">{{ item.time }}</div>
        </div>
      </div>
    </div>
  </UCard>
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
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: rgb(0 0 0 / 0.2);
  background-clip: padding-box;
}

.custom-scrollbar:hover::-webkit-scrollbar-thumb:hover {
  background-color: rgb(0 0 0 / 0.3);
}
</style>
