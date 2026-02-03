<script setup lang="ts">
const {  $t } = useI18n()

interface NewsItem {
  id: number;
  content: string;
  time: string;
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
]);
const moreNewsHandle = ()=>{
  console.log('moreNewsHandle')
}
</script>

<template>
  <UCard 
    :title="$t('page.home.creativity')" 
    borderless  
    size="sm"  
    class="h-[500px] overflow-y-scroll w-full [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:rgb(0_0_0/0.2)_transparent] custom-scrollbar"
  >
    <template #header>
      <div class="sticky-header flex justify-between items-center">
        <span>{{$t('page.home.projectNews.title')}}</span>
        <ULink @click="moreNewsHandle"  class="hover:text-primary text-primary" >{{ $t('page.home.projectNews.moreNews') }}</ULink>
      </div>
    </template>
    <UTimeline
      :items="newses"
    >
      <template #indicator="{item}">
        <div class="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
          <img 
            src="@/assets/imgs/soybean.jpg" 
            alt="用户头像" 
            class="w-full h-full object-cover"
          >
        </div>
      </template>
      <template #title="{ item }">
        <div class="flex flex-col">
          <span class="font-medium text-base">&nbsp;{{ item.content }}</span>
        </div>
      </template>
      <template #description="{ item }">
        <span class="text-black font-medium text-sm">{{ item.time }}</span>
        <USeparator />
      </template>
    </UTimeline>
  </UCard>
</template>

<style scoped>
/* 固定header样式 */
:deep([class*="header"]) {
  position: sticky;
  top: 0;
  z-index: 10;
  background: white;
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
}

.dark :deep([class*="header"]) {
  background: rgb(17 24 39);
}

/* Webkit滚动条样式（必须使用CSS，无法内联） */
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