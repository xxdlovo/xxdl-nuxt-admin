<script setup lang="ts">
import type { RbacMenu } from '#shared/auth'
import AppHeader from '../../global-header/index.vue'
import LayoutContent from '../../global-content/index.vue'
import MobileSidebar from '../../global-sider/mobile-sidebar.vue'

const props = defineProps<{
  menus: RbacMenu[]
  loading?: boolean
  refreshKey: number
}>()

const open = defineModel<boolean>('open', { required: true })
const collapsed = defineModel<boolean>('collapsed', { required: true })
const route = useRoute()
const renderableMenus = computed(() => getRenderableMenus(props.menus))
const activeTrail = computed(() => resolveActiveTrail(renderableMenus.value, route.path))
const dropdownUi = {
  content: 'z-[1000]'
}

function isActiveTopMenu(menu: RbacMenu) {
  return activeTrail.value[0]?.id === menu.id
}

function getTopMenuItems(menu: RbacMenu) {
  return toDropdownMenuItems(menu.children)
}
</script>

<template>
  <UDashboardGroup unit="rem">
    <MobileSidebar v-model:open="open" :menus="menus" :loading="loading" />

    <div class="flex min-w-0 flex-1 flex-col">
      <AppHeader class="relative z-50" show-logo show-logo-title show-menu>
        <template #menu>
          <div class="flex min-w-0 items-center gap-1">
            <template v-for="menu in renderableMenus" :key="menu.id">
              <UDropdownMenu
                v-if="getRenderableMenus(menu.children).length > 0"
                :items="getTopMenuItems(menu)"
                :content="{ side: 'bottom', align: 'start', sideOffset: 8, collisionPadding: 8 }"
                :ui="dropdownUi"
                arrow
              >
                <UButton
                  :label="menu.name"
                  :icon="normalizeMenuIcon(menu.icon)"
                  trailing-icon="i-lucide-chevron-down"
                  color="neutral"
                  :variant="isActiveTopMenu(menu) ? 'soft' : 'ghost'"
                />
              </UDropdownMenu>

              <UButton
                v-else
                :label="menu.name"
                :icon="normalizeMenuIcon(menu.icon)"
                :to="findFirstPath(menu)"
                color="neutral"
                :variant="isActiveTopMenu(menu) ? 'soft' : 'ghost'"
              />
            </template>
          </div>
        </template>
      </AppHeader>

      <LayoutContent :refresh-key="refreshKey">
        <slot />
      </LayoutContent>
    </div>
  </UDashboardGroup>
</template>
