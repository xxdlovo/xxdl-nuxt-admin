<script setup lang="ts">
import type { SysOssDto } from '#shared/system/oss'
import { useToastError, useToastSuccess, useToastWarning } from '~/utils/toast'

type UploadConfig = {
  id: string
  configName: string
  service: string
  bucketName?: string | null
  domain?: string | null
  isDefault?: number | null
}

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const props = defineProps<{
  visible: boolean
  operateType: string
  data?: SysOssDto
  close?: () => void
  refresh?: () => void | Promise<void>
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const configs = ref<UploadConfig[]>([])
const configId = ref('')
const file = ref<File | null>(null)
const loadingConfigs = ref(false)
const uploading = ref(false)
const progress = ref(0)
const xhrRef = shallowRef<XMLHttpRequest | null>(null)

const configItems = computed(() => configs.value.map(config => ({
  label: [
    config.configName,
    config.service ? $ts(`module.system.ossConfig.service${config.service.charAt(0).toUpperCase()}${config.service.slice(1)}`) : '',
    config.bucketName
  ].filter(Boolean).join(' / '),
  value: config.id
})))

const selectedConfig = computed(() => configs.value.find(config => config.id === configId.value))
const canUpload = computed(() => Boolean(configId.value && file.value && !uploading.value))

const formatFileSize = (size?: number | null) => {
  const value = Number(size || 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB`
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const resetUploadState = () => {
  file.value = null
  progress.value = 0
  uploading.value = false
  xhrRef.value = null
}

const loadConfigs = async () => {
  loadingConfigs.value = true
  try {
    configs.value = await $trpc.sysOss.uploadConfigs.query() as UploadConfig[]
    configId.value = configs.value.find(config => config.isDefault === 1)?.id || configs.value[0]?.id || ''
  } finally {
    loadingConfigs.value = false
  }
}

watch(visible, async (value) => {
  if (!value) return
  resetUploadState()
  await loadConfigs()
})

const closeDrawer = () => {
  if (uploading.value) {
    cancelUpload()
    return
  }
  props.close?.()
}

const parseUploadError = (xhr: XMLHttpRequest) => {
  try {
    const body = JSON.parse(xhr.responseText)
    return body.message || body.statusMessage || xhr.statusText
  } catch {
    return xhr.statusText || $ts('module.system.oss.uploadFailed')
  }
}

const upload = async () => {
  if (!configId.value) {
    useToastWarning($ts('module.system.oss.uploadConfigRequired'))
    return
  }
  if (!file.value) {
    useToastWarning($ts('module.system.oss.uploadFileRequired'))
    return
  }

  const formData = new FormData()
  formData.append('configId', configId.value)
  formData.append('file', file.value)

  uploading.value = true
  progress.value = 0

  await new Promise<void>((resolve) => {
    const xhr = new XMLHttpRequest()
    xhrRef.value = xhr
    xhr.open('POST', '/api/system/oss/upload')
    xhr.withCredentials = true

    const locale = useCookie<string>('i18n_locale').value || 'en'
    xhr.setRequestHeader('x-locale', locale)
    xhr.setRequestHeader('accept-language', locale)

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      progress.value = Math.min(95, Math.round((event.loaded / event.total) * 100))
    }

    xhr.onload = async () => {
      uploading.value = false
      xhrRef.value = null

      if (xhr.status >= 200 && xhr.status < 300) {
        progress.value = 100
        useToastSuccess($ts('module.system.oss.uploadSuccess'))
        visible.value = false
        await props.refresh?.()
      } else {
        useToastError($ts('module.system.oss.uploadFailed'), 5000, parseUploadError(xhr))
      }
      resolve()
    }

    xhr.onerror = () => {
      uploading.value = false
      xhrRef.value = null
      useToastError($ts('module.system.oss.uploadFailed'))
      resolve()
    }

    xhr.onabort = () => {
      uploading.value = false
      xhrRef.value = null
      progress.value = 0
      useToastWarning($ts('module.system.oss.uploadCanceled'))
      resolve()
    }

    xhr.send(formData)
  })
}

const cancelUpload = () => {
  xhrRef.value?.abort()
}
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="$ts('module.system.oss.upload')"
    :dismissible="!uploading"
    :ui="{ content: 'max-w-[720px]', footer: 'justify-end' }"
  >
    <template #body>
      <div class="space-y-5">
        <UAlert
          v-if="!loadingConfigs && configs.length === 0"
          color="warning"
          variant="soft"
          icon="i-lucide-circle-alert"
          :title="$ts('module.system.oss.noUploadConfig')"
          :description="$ts('module.system.oss.noUploadConfigDesc')"
        />

        <UFormField name="configId" required :label="$ts('module.system.oss.uploadConfig')">
          <USelect
            v-model="configId"
            :items="configItems"
            :loading="loadingConfigs"
            :disabled="uploading || configs.length === 0"
            :placeholder="$ts('module.system.oss.form.uploadConfig')"
            class="w-full"
          />
        </UFormField>

        <UAlert
          v-if="selectedConfig"
          color="neutral"
          variant="soft"
          icon="i-lucide-hard-drive"
          :title="selectedConfig.configName"
          :description="[selectedConfig.service, selectedConfig.bucketName, selectedConfig.domain].filter(Boolean).join(' / ')"
        />

        <UFormField name="file" required :label="$ts('module.system.oss.uploadFile')">
          <UFileUpload
            v-model="file"
            variant="area"
            layout="list"
            :disabled="uploading"
            :multiple="false"
            :label="$ts('module.system.oss.form.uploadFile')"
            :description="$ts('module.system.oss.uploadSingleOnly')"
            class="w-full"
          />
        </UFormField>

        <div v-if="file" class="text-sm text-muted">
          {{ file.name }} / {{ formatFileSize(file.size) }}
        </div>

        <div v-if="uploading || progress > 0" class="space-y-2">
          <div class="flex items-center justify-between text-sm text-muted">
            <span>{{ uploading ? $ts('module.system.oss.uploading') : $ts('module.system.oss.uploadProgress') }}</span>
            <span>{{ progress }}%</span>
          </div>
          <UProgress :model-value="progress" color="primary" />
        </div>
      </div>
    </template>

    <template #footer>
      <UButton
        v-if="uploading"
        color="warning"
        variant="outline"
        icon="i-lucide-ban"
        :label="$ts('module.system.oss.cancelUpload')"
        @click="cancelUpload"
      />
      <UButton
        v-else
        color="neutral"
        variant="subtle"
        :label="$ts('common.cancel')"
        @click="closeDrawer"
      />
      <UButton
        color="primary"
        icon="i-lucide-upload"
        :disabled="!canUpload"
        :loading="uploading"
        :label="$ts('module.system.oss.upload')"
        @click="upload"
      />
    </template>
  </UModal>
</template>
