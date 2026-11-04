<script setup lang="ts">
/**
 * 基座的默认首页。
 *
 * 这里刻意做成「无需任何业务接口」的欢迎页：
 * 基座只负责系统管理（用户/角色/菜单/字典/日志等），首页指标属于业务范畴。
 * 需要完整看板时安装 `xxdl-admin-trade` 层，该层会以自己的同名页面覆盖本文件。
 */
definePageMeta({
  layout: 'system'
})

const { user } = useUserSession()

const displayName = computed(() => user.value?.nickname || user.value?.username || '-')

const isAdmin = computed(() => user.value?.isAdmin === 1)

// 快捷入口：只放基座自带的系统管理模块，业务模块由接入方自行添加
const shortcuts = [
  { key: 'user', to: '/system/user', icon: 'i-lucide-users' },
  { key: 'role', to: '/system/role', icon: 'i-lucide-shield-check' },
  { key: 'menu', to: '/system/menu', icon: 'i-lucide-list-tree' },
  { key: 'dict', to: '/system/dict-type', icon: 'i-lucide-book-marked' },
  { key: 'notice', to: '/system/notice', icon: 'i-lucide-megaphone' },
  { key: 'sysLog', to: '/system/sys-log', icon: 'i-lucide-scroll-text' }
]
</script>

<template>
  <UPage>
    <UPageHeader
      :title="$ts('page.systemHome.title')"
      :description="$ts('page.systemHome.description')"
    />

    <UPageBody>
      <UCard>
        <div class="flex flex-wrap items-center gap-3">
          <UIcon
            name="i-lucide-party-popper"
            class="size-6 text-primary"
          />
          <span class="text-base">
            {{ $ts('page.systemHome.greeting') }}{{ displayName }}
          </span>
          <UBadge
            v-if="isAdmin"
            color="primary"
            variant="subtle"
          >
            {{ $ts('page.systemHome.adminBadge') }}
          </UBadge>
        </div>
      </UCard>

      <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <UCard
          v-for="item in shortcuts"
          :key="item.key"
          class="transition hover:ring-primary/40"
        >
          <NuxtLink
            :to="item.to"
            class="flex items-center gap-3"
          >
            <UIcon
              :name="item.icon"
              class="size-5 text-primary"
            />
            <span>{{ $ts(`page.systemHome.shortcuts.${item.key}`) }}</span>
            <UIcon
              name="i-lucide-arrow-right"
              class="ml-auto size-4 text-muted"
            />
          </NuxtLink>
        </UCard>
      </div>
    </UPageBody>
  </UPage>
</template>
