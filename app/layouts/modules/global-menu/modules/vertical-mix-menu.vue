<script setup lang="ts">
import type { RbacMenu } from '#shared/auth'
import AppHeader from '../../global-header/index.vue'
import AppLogo from '../../global-logo/index.vue'
import LayoutContent from '../../global-content/index.vue'
import MobileSidebar from '../../global-sider/mobile-sidebar.vue'
import FirstLevelMenu from '../components/first-level-menu.vue'
import MixChildDrawer from '../components/mix-child-drawer.vue'

const props = defineProps<{
  menus: RbacMenu[]
  loading?: boolean
  refreshKey: number
}>()

const open = defineModel<boolean>('open', { required: true })
const collapsed = defineModel<boolean>('collapsed', { required: true })
const themeStore = useThemeStore()
const drawerVisible = ref(false)

const {
  firstLevelMenus,
  activeFirstLevelMenu,
  secondLevelMenus,
  selectFirstLevelMenu
} = useMixMenu(() => props.menus)

const showDrawer = computed(() => secondLevelMenus.value.length > 0 && (drawerVisible.value || themeStore.mixSiderFixed))

async function handleSelectRoot(menu: RbacMenu) {
  drawerVisible.value = true
  await selectFirstLevelMenu(menu)
}

function handleMouseLeave() {
  drawerVisible.value = false
}
</script>

<template>
  <UDashboardGroup unit="rem">
    <MobileSidebar v-model:open="open" :menus="menus" :loading="loading" />

    <div
      class="relative hidden h-screen shrink-0 lg:flex"
      @mouseleave="handleMouseLeave"
    >
      <aside
        class="flex h-full shrink-0 flex-col border-r border-default bg-default"
        :style="{ width: `${collapsed ? themeStore.sider.mixCollapsedWidth : themeStore.sider.mixWidth}px` }"
      >
        <AppLogo :show-title="false" class="h-14 shrink-0 justify-center" />
        <div class="min-h-0 flex-1">
          <FirstLevelMenu
            :menus="firstLevelMenus"
            :active-id="activeFirstLevelMenu?.id"
            :collapsed="collapsed"
            inverted
            show-collapse
            @select="handleSelectRoot"
            @toggle-collapse="collapsed = !collapsed"
          />
        </div>
      </aside>

      <MixChildDrawer
        :menus="secondLevelMenus"
        :visible="showDrawer"
        :pinned="themeStore.mixSiderFixed"
        :width="themeStore.sider.mixChildMenuWidth"
        :title="activeFirstLevelMenu?.name"
        @toggle-pin="themeStore.toggleMixSiderFixed"
      />
    </div>

    <LayoutContent :refresh-key="refreshKey">
      <template #header>
        <AppHeader :collapsed="collapsed" :show-menu-toggler="false" />
      </template>
      <slot />
    </LayoutContent>
  </UDashboardGroup>
</template>
