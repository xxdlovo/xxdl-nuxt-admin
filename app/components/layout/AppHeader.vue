<script setup lang="ts">
import AppLogo from './AppLogo.vue'
import MenuToggler from './MenuToggler.vue'

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

    <div v-else class="flex h-full min-w-0 flex-1 items-center">
      <AppBreadcrumb
        :collapsed="Boolean(collapsed)"
        :show-sidebar-toggle="showMenuToggler !== false"
        @toggle-sidebar="emit('toggleMenu')"
      />
    </div>

    <div class="ml-auto flex shrink-0 items-center gap-2">
      <slot name="actions">
        <BaseSearch />
        <BaseSwitchLocal />
        <BaseThemePick />
        <UserProfile />
      </slot>
    </div>
  </header>
</template>
