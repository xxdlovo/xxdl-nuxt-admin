<script setup lang="ts">
import BaseThemeColorSetting from './BaseThemeColorSetting.vue'
import BaseThemePickerButton from './BaseThemePickerButton.vue'
import BaseThemeSettingsSection from './BaseThemeSettingsSection.vue'

const { $t } = useI18n()
const appConfig = useAppConfig()

const props = defineProps<{
  primaryRecommendations: string[]
  neutralRecommendations: string[]
  primaryPreviewHex?: string
}>()

const primary = defineModel<string>('primary', { required: true })
const info = defineModel<string>('info', { required: true })
const success = defineModel<string>('success', { required: true })
const warning = defineModel<string>('warning', { required: true })
const error = defineModel<string>('error', { required: true })
const neutral = defineModel<string>('neutral', { required: true })
const mode = defineModel<string>('mode', { required: true })
const radius = defineModel<number>('radius', { required: true })
const blackAsPrimary = defineModel<boolean>('blackAsPrimary', { required: true })

const radiuses = [0, 0.125, 0.25, 0.375, 0.5]

const modes = computed(() => [
  { label: $t('theme.themeSchema.light') as string, value: 'light', icon: appConfig.ui.icons.light },
  { label: $t('theme.themeSchema.dark') as string, value: 'dark', icon: appConfig.ui.icons.dark },
  { label: $t('theme.themeSchema.auto') as string, value: 'system', icon: appConfig.ui.icons.system }
])
</script>

<template>
  <div class="space-y-4">
    <!-- 外观页只负责主题外观相关的入口，后续新增颜色/模式/圆角项都往这里加。 -->
    <BaseThemeSettingsSection :title="$t('theme.themeColor.title') as string">
      <div class="space-y-4">
        <BaseThemeColorSetting
          v-model="primary"
          :label="$t('theme.themeColor.primary') as string"
          :recommendations="props.primaryRecommendations"
          :preview-hex="props.primaryPreviewHex"
        />

        <BaseThemeColorSetting
          v-model="info"
          :label="$t('theme.themeColor.info') as string"
          :recommendations="props.primaryRecommendations"
        />

        <BaseThemeColorSetting
          v-model="success"
          :label="$t('theme.themeColor.success') as string"
          :recommendations="props.primaryRecommendations"
        />

        <BaseThemeColorSetting
          v-model="warning"
          :label="$t('theme.themeColor.warning') as string"
          :recommendations="props.primaryRecommendations"
        />

        <BaseThemeColorSetting
          v-model="error"
          :label="$t('theme.themeColor.error') as string"
          :recommendations="props.primaryRecommendations"
        />

        <BaseThemeColorSetting
          v-model="neutral"
          :label="$t('theme.themeColor.neutral') as string"
          :recommendations="props.neutralRecommendations"
        />
      </div>
    </BaseThemeSettingsSection>

    <UDivider />

    <BaseThemeSettingsSection :title="$t('theme.themeSchema.title') as string">
      <div class="flex items-center justify-end gap-3">
        <UCheckbox
          v-model="blackAsPrimary"
          color="primary"
          :title="$t('theme.themeColor.blackAsPrimary') as string"
          :aria-label="$t('theme.themeColor.blackAsPrimary') as string"
        />
      </div>

      <div class="grid grid-cols-3 gap-2">
        <BaseThemePickerButton
          v-for="m in modes"
          :key="m.value"
          v-bind="m"
          :selected="mode === m.value"
          @click="mode = m.value"
        />
      </div>
    </BaseThemeSettingsSection>

    <UDivider />

    <BaseThemeSettingsSection :title="$t('theme.radius') as string">
      <div class="grid grid-cols-5 gap-1 -mx-1">
        <BaseThemePickerButton
          v-for="r in radiuses"
          :key="r"
          :label="String(r)"
          class="justify-center px-0"
          :selected="radius === r"
          @click="radius = r"
        />
      </div>
    </BaseThemeSettingsSection>
  </div>
</template>
