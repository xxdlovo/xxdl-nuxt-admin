<script setup lang="ts">
import type { LayoutMode, LayoutModeOption } from '#shared/layout'
import type { PageAnimateMode, ScrollMode, TabMode } from '~/stores/theme'
import BaseThemeSettingsSection from './BaseThemeSettingsSection.vue'
import LayoutModeSection from './layout/modules/layout-mode.vue'

const layoutMode = defineModel<LayoutMode>('layoutMode', { required: true })

const props = defineProps<{
  options: LayoutModeOption[]
}>()

const { $ts } = useI18n()
const toast = useToast()
const themeStore = useThemeStore()

const tabModeItems = computed(() => [
  { label: $ts('theme.tab.mode.chrome'), value: 'chrome' },
  { label: $ts('theme.tab.mode.button'), value: 'button' }
])

const scrollModeItems = computed(() => [
  { label: $ts('theme.scrollMode.wrapper'), value: 'wrapper' },
  { label: $ts('theme.scrollMode.content'), value: 'content' }
])

const pageAnimateModeItems = computed(() => [
  { label: $ts('theme.page.mode.fade-slide'), value: 'fade-slide' },
  { label: $ts('theme.page.mode.fade'), value: 'fade' },
  { label: $ts('theme.page.mode.fade-bottom'), value: 'fade-bottom' },
  { label: $ts('theme.page.mode.fade-scale'), value: 'fade-scale' },
  { label: $ts('theme.page.mode.zoom-fade'), value: 'zoom-fade' },
  { label: $ts('theme.page.mode.zoom-out'), value: 'zoom-out' },
  { label: $ts('theme.page.mode.none'), value: 'none' }
])

const currentTabMode = computed({
  get() {
    return themeStore.tab.mode
  },
  set(value: TabMode) {
    themeStore.tab.mode = value
  }
})

const currentScrollMode = computed({
  get() {
    return themeStore.content.scrollMode
  },
  set(value: ScrollMode) {
    themeStore.content.scrollMode = value
  }
})

const currentPageAnimateMode = computed({
  get() {
    return themeStore.content.pageAnimateMode
  },
  set(value: PageAnimateMode) {
    themeStore.content.pageAnimateMode = value
  }
})

async function copyConfig() {
  const text = JSON.stringify(themeStore.getLayoutSettingsSnapshot(), null, 2)

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    toast.add({
      title: $ts('common.copySuccess'),
      color: 'success'
    })
  }
}

function resetConfig() {
  themeStore.resetLayoutSettings()
  toast.add({
    title: $ts('theme.configOperation.resetSuccessMsg'),
    color: 'success'
  })
}
</script>

<template>
  <div class="space-y-5">
    <LayoutModeSection v-model:layout-mode="layoutMode" :options="props.options" />

    <UDivider />

    <BaseThemeSettingsSection :title="$ts('theme.tab.title')">
      <div class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-default">{{ $ts('theme.tab.visible') }}</span>
          <USwitch v-model="themeStore.tab.visible" />
        </div>

        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-default">{{ $ts('theme.tab.height') }}</span>
          <UInputNumber v-model="themeStore.tab.height" :min="32" :max="64" class="w-32" />
        </div>

        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-default">{{ $ts('theme.tab.mode.title') }}</span>
          <USelect v-model="currentTabMode" :items="tabModeItems" class="w-36" />
        </div>

        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-default">{{ $ts('theme.tab.middleClickClose') }}</span>
          <USwitch v-model="themeStore.tab.middleClickClose" />
        </div>
      </div>
    </BaseThemeSettingsSection>

    <UDivider />

    <BaseThemeSettingsSection :title="$ts('theme.header.title')">
      <div class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-default">{{ $ts('theme.header.height') }}</span>
          <UInputNumber v-model="themeStore.header.height" :min="48" :max="72" class="w-32" />
        </div>

        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-default">{{ $ts('theme.header.breadcrumb.visible') }}</span>
          <USwitch v-model="themeStore.header.breadcrumbVisible" />
        </div>

        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-default">{{ $ts('theme.header.breadcrumb.showIcon') }}</span>
          <USwitch v-model="themeStore.header.breadcrumbIconVisible" />
        </div>
      </div>
    </BaseThemeSettingsSection>

    <UDivider />

    <BaseThemeSettingsSection :title="$ts('theme.sider.title')">
      <div class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-default">{{ $ts('theme.sider.width') }}</span>
          <UInputNumber v-model="themeStore.sider.width" :min="160" :max="320" class="w-32" />
        </div>

        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-default">{{ $ts('theme.sider.collapsedWidth') }}</span>
          <UInputNumber v-model="themeStore.sider.collapsedWidth" :min="48" :max="96" class="w-32" />
        </div>
      </div>
    </BaseThemeSettingsSection>

    <UDivider />

    <BaseThemeSettingsSection :title="$ts('theme.footer.title')">
      <div class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-default">{{ $ts('theme.footer.visible') }}</span>
          <USwitch v-model="themeStore.footer.visible" />
        </div>

        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-default">{{ $ts('theme.footer.height') }}</span>
          <UInputNumber v-model="themeStore.footer.height" :min="32" :max="80" class="w-32" />
        </div>
      </div>
    </BaseThemeSettingsSection>

    <UDivider />

    <BaseThemeSettingsSection :title="$ts('theme.content.title')">
      <div class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-default">{{ $ts('theme.scrollMode.title') }}</span>
          <USelect v-model="currentScrollMode" :items="scrollModeItems" class="w-36" />
        </div>

        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-default">{{ $ts('theme.page.animate') }}</span>
          <USwitch v-model="themeStore.content.pageAnimate" />
        </div>

        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-default">{{ $ts('theme.page.mode.title') }}</span>
          <USelect v-model="currentPageAnimateMode" :items="pageAnimateModeItems" class="w-36" />
        </div>
      </div>
    </BaseThemeSettingsSection>

    <div class="flex items-center justify-between border-t border-default pt-4">
      <UButton
        color="error"
        variant="outline"
        :label="$ts('theme.configOperation.resetConfig')"
        @click="resetConfig"
      />
      <UButton
        color="primary"
        :label="$ts('theme.configOperation.copyConfig')"
        @click="copyConfig"
      />
    </div>
  </div>
</template>
