<script setup lang="ts">
import type { RbacMenu } from '#shared/auth'
import AppHeader from '../AppHeader.vue'
import FirstLevelMenu from '../FirstLevelMenu.vue'
import LayoutContent from '../LayoutContent.vue'
import MobileSidebar from '../MobileSidebar.vue'

const props = defineProps<{
  menus: RbacMenu[]
  loading?: boolean
  refreshKey: number
}>()

const open = defineModel<boolean>('open', { required: true })
const collapsed = defineModel<boolean>('collapsed', { required: true })
const themeStore = useThemeStore()

const {
  firstLevelMenus,
  activeFirstLevelMenu,
  activeSecondLevelMenu,
  secondLevelMenus,
  activateFirstLevelMenu,
  selectFirstLevelMenuAndGoDeepest
} = useMixMenu(() => props.menus)

const dropdownUi = {
  content: 'z-[1000]'
}

function isActiveSecondMenu(menu: RbacMenu) {
  return activeSecondLevelMenu.value?.id === menu.id
}

function getHeaderMenuItems(menu: RbacMenu) {
  return toDropdownMenuItems(menu.children)
}

function handleSelectFirstLevel(menu: RbacMenu) {
  if (menu.type === 0) {
    activateFirstLevelMenu(menu)
    return
  }

  void selectFirstLevelMenuAndGoDeepest(menu)
}
</script>

<template>
  <UDashboardGroup unit="rem">
    <MobileSidebar v-model:open="open" :menus="menus" :loading="loading" />

    <div class="flex min-w-0 flex-1 flex-col">
      <AppHeader class="relative z-50" show-logo show-logo-title show-menu>
        <template #menu>
          <div class="flex min-w-0 items-center gap-1">
            <template v-for="menu in secondLevelMenus" :key="menu.id">
              <UDropdownMenu
                v-if="getRenderableMenus(menu.children).length > 0"
                :items="getHeaderMenuItems(menu)"
                :content="{ side: 'bottom', align: 'start', sideOffset: 8, collisionPadding: 8 }"
                :ui="dropdownUi"
                arrow
              >
                <UButton
                  :label="menu.name"
                  :icon="normalizeMenuIcon(menu.icon)"
                  trailing-icon="i-lucide-chevron-down"
                  color="neutral"
                  :variant="isActiveSecondMenu(menu) ? 'soft' : 'ghost'"
                />
              </UDropdownMenu>

              <UButton
                v-else
                :label="menu.name"
                :icon="normalizeMenuIcon(menu.icon)"
                :to="findFirstPath(menu)"
                color="neutral"
                :variant="isActiveSecondMenu(menu) ? 'soft' : 'ghost'"
              />
            </template>
          </div>
        </template>
      </AppHeader>

      <div class="flex min-h-0 flex-1">
        <aside
          class="hidden h-full min-h-0 shrink-0 border-r border-default bg-default lg:flex"
          :style="{ width: `${collapsed ? themeStore.sider.mixCollapsedWidth : themeStore.sider.mixWidth}px` }"
        >
          <FirstLevelMenu
            :menus="firstLevelMenus"
            :active-id="activeFirstLevelMenu?.id"
            :collapsed="collapsed"
            @select="handleSelectFirstLevel"
            @toggle-collapse="collapsed = !collapsed"
          />
        </aside>

        <LayoutContent :refresh-key="refreshKey">
          <slot />
        </LayoutContent>
      </div>
    </div>
  </UDashboardGroup>
</template>
