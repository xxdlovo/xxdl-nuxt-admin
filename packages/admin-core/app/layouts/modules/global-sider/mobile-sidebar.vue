<script setup lang="ts">
import type { RbacMenu } from '#admin/shared/auth'

const props = defineProps<{
  menus: RbacMenu[]
  loading?: boolean
}>()

const { $ts } = useI18n()
const open = defineModel<boolean>('open', { required: true })
const items = computed(() => toNavigationItems(props.menus, () => {
  open.value = false
}))
</script>

<template>
  <UDashboardSidebar
    id="mobile-sidebar"
    v-model:open="open"
    :toggle="false"
    class="lg:hidden"
    :ui="{
      content: 'w-[78vw] max-w-[320px]',
      footer: 'border-t border-default'
    }"
  >
    <template #header>
      <div class="flex w-full min-w-0 items-center gap-2">
        <!-- 关闭按钮在抽屉内容内：点击不会被判定为外部点击，且与关闭态菜单按钮位置接近 -->
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          square
          aria-label="关闭菜单"
          class="-ml-1 shrink-0"
          @click="open = false"
        />
        <img
          src="/favicon.ico"
          alt=""
          class="h-7 w-7 shrink-0 object-contain"
          aria-hidden="true"
        >
        <span class="truncate font-semibold text-primary">
          {{ $ts('system.title') }}
        </span>
      </div>
    </template>

    <template #default>
      <div v-if="loading" class="flex items-center gap-2 px-2 py-1.5 text-sm text-muted">
        <UIcon name="i-lucide-loader-circle" class="animate-spin" />
        <span>Loading</span>
      </div>

      <UNavigationMenu
        v-else-if="items.length > 0"
        :items="items"
        orientation="vertical"
      />

      <div v-else class="px-2 py-1.5 text-sm text-muted">
        No menus
      </div>
    </template>
  </UDashboardSidebar>
</template>
