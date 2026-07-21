<script setup lang="ts">
import type { RbacMenu } from '#shared/auth'
import { findMenuTrail, normalizeNavigationIcon, resolveNavigationMeta } from '~/utils/navigation'

const { $ts } = useI18n()

type BreadcrumbItem = {
  label: string
  icon?: string | null
  to?: string
  active?: boolean
  children?: BreadcrumbChild[]
}

type BreadcrumbChild = {
  label: string
  icon?: string | null
  to?: string
  disabled?: boolean
}

const route = useRoute()
const router = useRouter()
const { profile } = useRbacProfile()
const openBreadcrumbKey = ref<string | null>(null)

const props = defineProps<{
  collapsed: boolean
  showSidebarToggle?: boolean
}>()

const emit = defineEmits<{
  toggleSidebar: []
}>()

function toBreadcrumbChildren(menus: RbacMenu[]): BreadcrumbChild[] {
  return menus
    .filter(menu => menu.type !== 2)
    .map(menu => {
      const clickable = menu.type !== 0 && Boolean(menu.path)

      return {
        label: menu.name,
        icon: normalizeNavigationIcon(menu.icon),
        to: clickable ? menu.path || undefined : undefined,
        disabled: !clickable
      }
    })
}

function breadcrumbKey(item: BreadcrumbItem, index: number) {
  return `${index}:${item.label}`
}

function setBreadcrumbOpen(item: BreadcrumbItem, index: number, open: boolean) {
  openBreadcrumbKey.value = open ? breadcrumbKey(item, index) : null
}

async function navigateToChild(child: BreadcrumbChild, close?: () => void) {
  if (!child.to || child.disabled) {
    return
  }

  openBreadcrumbKey.value = null
  close?.()
  await router.push(child.to)
}

const routeMeta = computed(() => route.meta as { title?: string })

const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  const menus = profile.value?.menus ?? []
  const trail = findMenuTrail(menus, route.path)

  if (trail && trail.length > 0) {
    return trail.map((menu, index) => {
      const isCurrent = index === trail.length - 1

      return {
        label: isCurrent ? String(routeMeta.value.title || menu.name) : menu.name,
        icon: normalizeNavigationIcon(menu.icon),
        to: !isCurrent && menu.type !== 0 ? menu.path || undefined : undefined,
        active: isCurrent,
        children: !isCurrent ? toBreadcrumbChildren(menu.children) : undefined
      }
    })
  }

  const matchedItems = route.matched
    .filter(record => Boolean((record.meta as { title?: string }).title))
    .map((record, index, records) => {
      const meta = record.meta as { title?: string }
      const isCurrent = index === records.length - 1
      const navMeta = resolveNavigationMeta(menus, record.path, meta, String(meta.title || record.path))

      return {
        label: String(meta.title),
        icon: navMeta.icon,
        to: !isCurrent ? record.path : undefined,
        active: isCurrent
      }
    })

  if (matchedItems.length > 0) {
    return matchedItems
  }

  return [{
    label: String(routeMeta.value.title || route.name || '页面'),
    icon: resolveNavigationMeta(menus, route.path, routeMeta.value, String(route.name || route.path)).icon,
    active: true
  }]
})
</script>

<template>
  <div class="flex h-10 items-center gap-3 border-b border-gray-200 bg-white px-3 dark:border-gray-800 dark:bg-gray-950">
    <UTooltip v-if="props.showSidebarToggle !== false" :text="props.collapsed ? $ts('icon.expand') : $ts('icon.collapse')">
      <UButton
        :icon="props.collapsed ? 'icon-park:menu-unfold' : 'icon-park:menu-fold'"
        color="neutral"
        variant="ghost"
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
    >
      <template #item="{ item, active, index }">
        <!-- Parent breadcrumb: hover to open the child menu -->
        <UPopover
          v-if="item.children?.length"
          :open="openBreadcrumbKey === breadcrumbKey(item, index)"
          mode="hover"
          :open-delay="80"
          :close-delay="120"
          :ui="{ content: 'min-w-44 p-1' }"
          @update:open="value => setBreadcrumbOpen(item, index, value)"
        >
          <!-- Breadcrumb item size is controlled here: UButton size + padding classes -->
          <UButton
            color="neutral"
            :variant="active ? 'soft' : 'ghost'"
            size="sm"
            class="min-w-0 rounded-md px-1.5 py-1 text-sm font-medium"
            :class="active ? 'text-highlighted' : ''"
          >
            <UIcon v-if="item.icon" :name="item.icon" class="size-4 shrink-0" />
            <span class="truncate">{{ item.label }}</span>
          </UButton>

          <template #content="{ close }">
            <!-- Child menu list: close popover after navigation -->
            <div class="flex flex-col gap-0.5">
              <UButton
                v-for="child in item.children"
                :key="child.to || child.label"
                color="neutral"
                variant="ghost"
                size="sm"
                class="min-w-0 justify-start rounded-md px-2.5 py-2 text-sm text-default transition-colors"
                :class="child.disabled
                  ? 'cursor-not-allowed opacity-60'
                  : 'cursor-pointer hover:bg-elevated hover:text-highlighted'"
                :disabled="child.disabled"
                @click="navigateToChild(child, close)"
              >
                <UIcon v-if="child.icon" :name="child.icon" class="size-4 shrink-0 text-muted" />
                <span class="truncate">{{ child.label }}</span>
              </UButton>
            </div>
          </template>
        </UPopover>

        <span
          v-else
          class="flex min-w-0 items-center gap-1.5 text-sm"
          :class="active ? 'font-semibold text-highlighted' : 'font-medium text-muted'"
        >
          <UIcon v-if="item.icon" :name="item.icon" class="size-4 shrink-0" />
          <span class="truncate">{{ item.label }}</span>
        </span>
      </template>
    </UBreadcrumb>

    <div class="flex min-w-0 shrink-0 items-center gap-2">
      <slot name="right" />
    </div>
  </div>
</template>
