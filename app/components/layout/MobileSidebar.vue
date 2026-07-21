<script setup lang="ts">
import type { RbacMenu } from '#shared/auth'
import AppLogo from './AppLogo.vue'

const props = defineProps<{
  menus: RbacMenu[]
  loading?: boolean
}>()

const open = defineModel<boolean>('open', { required: true })
const items = computed(() => toNavigationItems(props.menus, () => {
  open.value = false
}))
</script>

<template>
  <UDashboardSidebar
    id="mobile-sidebar"
    v-model:open="open"
    class="lg:hidden"
    :ui="{ footer: 'border-t border-default' }"
  >
    <template #header>
      <AppLogo />
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
