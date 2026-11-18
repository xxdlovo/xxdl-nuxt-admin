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
  /** 移动端紧凑模式：隐藏面包屑，只保留菜单按钮与右侧操作区 */
  compact?: boolean
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

    <!-- 移动端：菜单按钮由布局层以 fixed 渲染（保证抽屉打开时仍可点击关闭），这里只留占位 -->
    <div v-if="compact" class="w-9 shrink-0" aria-hidden="true" />

    <MenuToggler
      v-else-if="showMenu && showMenuToggler"
      :collapsed="collapsed"
      @click="emit('toggleMenu')"
    />

    <div v-if="showMenu" class="flex h-full min-w-0 flex-1 items-center">
      <slot name="menu" />
    </div>

    <div v-else-if="!compact" class="relative flex h-full min-w-0 flex-1 items-center">
      <!-- 菜单按钮只保留 header 左侧这一个，避免面包屑内重复的 toggle 造成双重触发 -->
      <AppBreadcrumb
        :collapsed="Boolean(collapsed)"
        :show-sidebar-toggle="false"
        @toggle-sidebar="emit('toggleMenu')"
      />
      <div class="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-default" />
    </div>

    <div v-else class="flex-1" />

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
