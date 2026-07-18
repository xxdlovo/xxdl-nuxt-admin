<script setup lang="ts">
import type { RbacMenu } from '#shared/auth'

type BreadcrumbItem = {
  label: string
  icon?: string | null
  to?: string
  active?: boolean
}

const route = useRoute()
const { profile } = useRbacProfile()

const props = defineProps<{
  collapsed: boolean
}>()

const emit = defineEmits<{
  toggleSidebar: []
}>()

function normalizeIcon(icon?: string | null) {
  return icon || 'i-lucide-circle'
}

function findMenuTrail(menus: RbacMenu[], path: string): RbacMenu[] | null {
  for (const menu of menus) {
    if (menu.path === path) {
      return [menu]
    }

    const childTrail = findMenuTrail(menu.children, path)
    if (childTrail) {
      return [menu, ...childTrail]
    }
  }

  return null
}

const routeMeta = computed(() => route.meta as { title?: string; icon?: string })

const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  const trail = findMenuTrail(profile.value?.menus ?? [], route.path)

  if (trail && trail.length > 0) {
    return trail.map((menu, index) => {
      const isCurrent = index === trail.length - 1

      return {
        label: isCurrent ? String(routeMeta.value.title || menu.name) : menu.name,
        icon: isCurrent ? normalizeIcon(routeMeta.value.icon || menu.icon) : normalizeIcon(menu.icon),
        to: !isCurrent ? menu.path || undefined : undefined,
        active: isCurrent
      }
    })
  }

  const matchedItems = route.matched
    .filter(record => Boolean((record.meta as { title?: string }).title))
    .map((record, index, records) => {
      const meta = record.meta as { title?: string; icon?: string }
      const isCurrent = index === records.length - 1

      return {
        label: String(meta.title),
        icon: normalizeIcon(meta.icon),
        to: !isCurrent ? record.path : undefined,
        active: isCurrent
      }
    })

  if (matchedItems.length > 0) {
    return matchedItems
  }

  return [{
    label: String(routeMeta.value.title || route.name || '页面'),
    icon: normalizeIcon(routeMeta.value.icon),
    active: true
  }]
})
</script>

<template>
  <div class="flex h-10 items-center gap-3 border-b border-gray-200 bg-white px-3 dark:border-gray-800 dark:bg-gray-950">
    <UTooltip :text="props.collapsed ? '展开侧栏' : '收起侧栏'">
      <UButton
        :icon="props.collapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
        color="neutral"
        variant="ghost"
        size="sm"
        square
        @click="emit('toggleSidebar')"
      />
    </UTooltip>

    <UBreadcrumb
      :items="breadcrumbs"
      color="neutral"
      separator-icon="i-lucide-slash"
      :ui="{
        root: 'min-w-0 flex-1 overflow-hidden',
        list: 'min-w-0 flex-nowrap overflow-hidden',
        item: 'min-w-0',
        link: 'min-w-0',
        linkLabel: 'truncate'
      }"
    />

    <div class="flex min-w-0 shrink-0 items-center gap-2">
      <slot name="right" />
    </div>
  </div>
</template>
