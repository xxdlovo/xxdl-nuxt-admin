<script setup lang="ts">
import type { SysOssDto } from '#admin/shared/system/oss'
import { useToastError, useToastSuccess, useToastWarning } from '#admin/app/utils/toast'

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
const files = ref<File[]>([])
const loadingConfigs = ref(false)
const uploading = ref(false)
const progress = ref(0)
const completedCount = ref(0)
const totalCount = ref(0)
const failedFiles = ref<Array<{ name: string, message: string }>>([])
const xhrRef = shallowRef<XMLHttpRequest | null>(null)
let canceled = false

const configItems = computed(() => configs.value.map(config => ({
  label: [
    config.configName,
    config.service ? $ts(`module.system.ossConfig.service${config.service.charAt(0).toUpperCase()}${config.service.slice(1)}`) : '',
    config.bucketName
  ].filter(Boolean).join(' / '),
  value: config.id
})))

const selectedConfig = computed(() => configs.value.find(config => config.id === configId.value))
const totalSize = computed(() => files.value.reduce((sum, item) => sum + item.size, 0))
const canUpload = computed(() => Boolean(configId.value && files.value.length > 0 && !uploading.value))

const formatFileSize = (size?: number | null) => {
  const value = Number(size || 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB`
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const resetUploadState = () => {
  files.value = []
  failedFiles.value = []
  progress.value = 0
  completedCount.value = 0
  totalCount.value = 0
  uploading.value = false
  canceled = false
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

const uploadOne = (current: File, index: number) => new Promise<{ ok: boolean, canceled?: boolean, message?: string }>((resolve) => {
  const formData = new FormData()
  formData.append('configId', configId.value)
  formData.append('file', current)

  const xhr = new XMLHttpRequest()
  xhrRef.value = xhr
  xhr.open('POST', '/api/system/oss/upload')
  xhr.withCredentials = true

  const locale = useCookie<string>('i18n_locale').value || 'en'
  xhr.setRequestHeader('x-locale', locale)
  xhr.setRequestHeader('accept-language', locale)

  xhr.upload.onprogress = (event) => {
    if (!event.lengthComputable || totalCount.value === 0) return
    const fileProgress = event.loaded / event.total
    progress.value = Math.min(95, Math.round(((index + fileProgress) / totalCount.value) * 100))
  }

  xhr.onload = () => {
    xhrRef.value = null
    if (xhr.status >= 200 && xhr.status < 300) {
      resolve({ ok: true })
      return
    }
    resolve({ ok: false, message: parseUploadError(xhr) })
  }

  xhr.onerror = () => {
    xhrRef.value = null
    resolve({ ok: false, message: $ts('module.system.oss.uploadFailed') })
  }

  xhr.onabort = () => {
    xhrRef.value = null
    resolve({ ok: false, canceled: true })
  }

  xhr.send(formData)
})

const upload = async () => {
  if (!configId.value) {
    useToastWarning($ts('module.system.oss.uploadConfigRequired'))
    return
  }
  if (files.value.length === 0) {
    useToastWarning($ts('module.system.oss.uploadFileRequired'))
    return
  }

  const selectedFiles = [...files.value]
  totalCount.value = selectedFiles.length
  completedCount.value = 0
  failedFiles.value = []
  progress.value = 0
  canceled = false
  uploading.value = true

  const failedIndexes = new Set<number>()

  try {
    for (let index = 0; index < selectedFiles.length; index += 1) {
      if (canceled) break

      const result = await uploadOne(selectedFiles[index]!, index)

      if (result.canceled) {
        canceled = true
        break
      }

      if (result.ok) {
        completedCount.value += 1
      }
      else {
        failedIndexes.add(index)
        failedFiles.value.push({
          name: selectedFiles[index]!.name,
          message: result.message || $ts('module.system.oss.uploadFailed'),
        })
      }

      progress.value = Math.min(100, Math.round(((index + 1) / totalCount.value) * 100))
    }
  }
  finally {
    uploading.value = false
    xhrRef.value = null
  }

  if (canceled) {
    progress.value = 0
    useToastWarning($ts('module.system.oss.uploadCanceled'))
    return
  }

  if (failedFiles.value.length === 0) {
    progress.value = 100
    useToastSuccess($ts('module.system.oss.uploadSuccess'))
    visible.value = false
    await props.refresh?.()
    return
  }

  // 保留失败文件，用户可以直接重试；成功文件不重复上传。
  files.value = selectedFiles.filter((_, index) => failedIndexes.has(index))
  progress.value = 0
  useToastError(
    $ts('module.system.oss.uploadPartial', {
      success: completedCount.value,
      failed: failedFiles.value.length,
    }),
    5000,
    failedFiles.value.map(item => `${item.name}: ${item.message}`).join('\n')
  )
  await props.refresh?.()
}

const cancelUpload = () => {
  canceled = true
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
            v-model="files"
            variant="area"
            layout="list"
            :disabled="uploading"
            :multiple="true"
            :label="$ts('module.system.oss.form.uploadFile')"
            :description="$ts('module.system.oss.uploadMultiHint')"
            class="w-full"
          />
        </UFormField>

        <div v-if="files.length > 0" class="text-sm text-muted">
          {{ $ts('module.system.oss.uploadTotal', { count: files.length }) }} / {{ formatFileSize(totalSize) }}
        </div>

        <UAlert
          v-if="failedFiles.length > 0"
          color="error"
          variant="soft"
          icon="i-lucide-circle-alert"
          :title="$ts('module.system.oss.uploadFailedFiles')"
        >
          <template #description>
            <ul class="list-disc space-y-1 pl-4">
              <li v-for="item in failedFiles" :key="item.name">
                {{ item.name }}：{{ item.message }}
              </li>
            </ul>
          </template>
        </UAlert>

        <div v-if="uploading || progress > 0" class="space-y-2">
          <div class="flex items-center justify-between text-sm text-muted">
            <span>{{ uploading ? $ts('module.system.oss.uploading') : $ts('module.system.oss.uploadProgress') }}</span>
            <span>{{ progress }}%<template v-if="uploading && totalCount > 0">（{{ completedCount }}/{{ totalCount }}）</template></span>
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
