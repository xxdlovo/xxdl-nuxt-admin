<script setup lang="ts">
import AppLogo from '../global-logo/index.vue'
import AppBreadcrumb from '../global-breadcrumb/index.vue'
import MenuToggler from './components/menu-toggler.vue'

defineProps<{
  showLogo?: boolean
  showLogoTitle?: boolean
  showMenu?: boolean
  showMenuToggler?: boolean
  collapsed?: boolean
}>()

const emit = defineEmits<{
  toggleMenu: []
}>()

const themeStore = useThemeStore()
</script>

<template>
  <header
    class="flex shrink-0 items-center gap-2 border-b border-default bg-default px-3"
    :style="{ height: `${themeStore.header.height}px` }"
  >
    <AppLogo
      v-if="showLogo"
      :show-title="showLogoTitle !== false"
      class="h-full shrink-0"
      :style="{ width: `${showLogoTitle === false ? themeStore.sider.mixCollapsedWidth : themeStore.sider.width}px` }"
    />

    <MenuToggler
      v-if="showMenu && showMenuToggler"
      :collapsed="collapsed"
      @click="emit('toggleMenu')"
    />

    <div v-if="showMenu" class="flex h-full min-w-0 flex-1 items-center">
      <slot name="menu" />
    </div>

    <div v-else class="relative flex h-full min-w-0 flex-1 items-center">
      <AppBreadcrumb
        :collapsed="Boolean(collapsed)"
        :show-sidebar-toggle="showMenuToggler !== false"
        @toggle-sidebar="emit('toggleMenu')"
      />
      <div class="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-default" />
    </div>

    <div class="ml-auto flex shrink-0 items-center gap-2">
      <slot name="actions">
        <BaseSearch v-if="themeStore.general.globalSearchVisible" />
        <BaseSwitchLocal v-if="themeStore.general.localeVisible" />
        <BaseThemePick />
        <UserProfile />
      </slot>
    </div>
  </header>
</template>
