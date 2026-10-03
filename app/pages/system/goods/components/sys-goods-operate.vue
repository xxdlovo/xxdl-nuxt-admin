<script setup lang="ts">
import {
  type SysGoodsLevelPriceItemDTO,
  type SysGoodsRespDTO,
  SysGoodsAddSchema,
  SysGoodsUpdateSchema
} from '#shared/system/goods'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { goodsTypeRecord } from '#shared/constants/business'
import { useToastError, useToastSuccess, useToastWarning } from '~/utils/toast'

type UploadConfig = {
  id: string
  configName: string
  service: string
  bucketName?: string | null
  domain?: string | null
  isDefault?: number | null
}

/**
 * 表单草稿：可空字段统一用空串、金额/库存用 null 表示「未填」，
 * 提交时再拼成契约 DTO，避免把空串写进 decimal / int 列。
 */
type GoodsDraft = {
  id: string
  name: string
  subtitle: string
  cover: string
  price: number | null
  stock: number | null
  unlimitedStock: number
  type: 'virtual' | 'service' | 'physical'
  serviceNotice: string
  detail: string
  sortOrder: number | null
  status: number
  remark: string
}

/** 等级价行：一行一个等级，price 为 null 表示该等级用基础价 */
type LevelPriceRow = {
  levelId: string
  levelName: string
  price: number | null
  remark: string
  /** 等级已停用但仍有专属价：一并回显，保存时原样带回，避免整体替换把它清掉 */
  disabled: boolean
}

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const { hasPermission, isAdmin } = useRbacProfile()

const props = defineProps<{
  visible: boolean
  operateType: string
  data?: SysGoodsRespDTO
  close?: () => void
  /** 参数为本次改动保存后的商品 id，供列表刷新单行的派生数据（等级价数量） */
  refresh?: (changedGoodsId?: string) => void | Promise<void>
}>()

const formItemUi = {
  root: 'flex items-center',
  label: 'w-32 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const emptyDraft = (): GoodsDraft => ({
  id: '',
  name: '',
  subtitle: '',
  cover: '',
  price: null,
  stock: 0,
  unlimitedStock: 0,
  type: 'virtual',
  serviceNotice: '',
  detail: '',
  sortOrder: 0,
  status: 1,
  remark: ''
})

const state = ref<GoodsDraft>(emptyDraft())
const saving = ref(false)

const { validate } = useZodValidation({
  schema: () => props.operateType === 'add' ? SysGoodsAddSchema : SysGoodsUpdateSchema
})

/**
 * 契约里 price/stock 这类字段没有自定义错误文案（shared 不能改），
 * 这里把 zod 的原始英文报错替换成 i18n 文案，保证弹窗内不出现未翻译的可见文案。
 * 带「.」的 message 是契约里的 i18n key，已由 useZodValidation 翻译过，保持原样。
 */
const validateForm = async (stateValue: unknown) => {
  const draft = stateValue as GoodsDraft
  // 库存/排序留空等价于 0：先归一化再校验，避免「不限库存」时被清空的库存输入拦住提交
  const errors = await validate({
    ...draft,
    stock: draft.stock ?? 0,
    sortOrder: draft.sortOrder ?? 0
  })

  return errors.map((error) => {
    if (error.message.includes('.')) {
      return error
    }

    return {
      name: error.name,
      message: error.name === 'price'
        ? $ts('module.system.goods.form.priceRequired')
        : $ts('common.pleaseCheckValue')
    }
  })
}

const typeItems = useTransformRecordToOption(goodsTypeRecord)

const toNumberOrNull = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

/* ── 封面：上传（对象存储）或手填 URL 二选一 ───────────────────────────── */

/** 上传走 /api/system/oss/upload，该接口按 system:oss:add 鉴权，无权限时降级为只填 URL */
const canUploadCover = computed(() => isAdmin.value || hasPermission('system:oss:add'))

const uploadConfigs = ref<UploadConfig[]>([])
const uploadConfigId = ref('')
const loadingUploadConfigs = ref(false)
const coverFile = ref<File | null>(null)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadXhr = shallowRef<XMLHttpRequest | null>(null)

const uploadConfigItems = computed(() => uploadConfigs.value.map(config => ({
  label: [config.configName, config.bucketName].filter(Boolean).join(' / '),
  value: config.id
})))

const canUpload = computed(() => Boolean(uploadConfigId.value && coverFile.value && !uploading.value))

const loadUploadConfigs = async () => {
  loadingUploadConfigs.value = true

  try {
    const configs = await $trpc.sysOss.uploadConfigs.query() as UploadConfig[]
    uploadConfigs.value = configs
    uploadConfigId.value = configs.find(config => config.isDefault === 1)?.id || configs[0]?.id || ''
  } catch {
    // 配置读不到就只保留手填 URL（错误提示已由全局 tRPC 处理器给出）
    uploadConfigs.value = []
    uploadConfigId.value = ''
  } finally {
    loadingUploadConfigs.value = false
  }
}

const parseUploadError = (xhr: XMLHttpRequest) => {
  try {
    const body = JSON.parse(xhr.responseText)
    return body.message || body.statusMessage || xhr.statusText
  } catch {
    return xhr.statusText || $ts('module.system.oss.uploadFailed')
  }
}

const resetUploadState = () => {
  coverFile.value = null
  uploadProgress.value = 0
  uploading.value = false
  uploadXhr.value = null
}

const cancelUpload = () => {
  uploadXhr.value?.abort()
}

const uploadCover = async () => {
  if (!uploadConfigId.value) {
    useToastWarning($ts('module.system.oss.uploadConfigRequired'))
    return
  }
  if (!coverFile.value) {
    useToastWarning($ts('module.system.oss.uploadFileRequired'))
    return
  }

  const formData = new FormData()
  formData.append('configId', uploadConfigId.value)
  formData.append('file', coverFile.value)

  uploading.value = true
  uploadProgress.value = 0

  await new Promise<void>((resolve) => {
    const xhr = new XMLHttpRequest()
    uploadXhr.value = xhr
    xhr.open('POST', '/api/system/oss/upload')
    xhr.withCredentials = true

    const locale = useCookie<string>('i18n_locale').value || 'en'
    xhr.setRequestHeader('x-locale', locale)
    xhr.setRequestHeader('accept-language', locale)

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      uploadProgress.value = Math.min(95, Math.round((event.loaded / event.total) * 100))
    }

    xhr.onload = () => {
      uploading.value = false
      uploadXhr.value = null

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText)
          const url = body?.data?.url

          if (url) {
            state.value.cover = url
            uploadProgress.value = 100
            coverFile.value = null
            useToastSuccess($ts('module.system.oss.uploadSuccess'))
          } else {
            useToastError($ts('module.system.oss.uploadFailed'))
          }
        } catch {
          useToastError($ts('module.system.oss.uploadFailed'))
        }
      } else {
        useToastError($ts('module.system.oss.uploadFailed'), 5000, parseUploadError(xhr))
      }

      resolve()
    }

    xhr.onerror = () => {
      uploading.value = false
      uploadXhr.value = null
      useToastError($ts('module.system.oss.uploadFailed'))
      resolve()
    }

    xhr.onabort = () => {
      uploading.value = false
      uploadXhr.value = null
      uploadProgress.value = 0
      useToastWarning($ts('module.system.oss.uploadCanceled'))
      resolve()
    }

    xhr.send(formData)
  })
}

/* ── 会员等级价（编辑态） ──────────────────────────────────────────────── */

const levelRows = ref<LevelPriceRow[]>([])
const levelPriceLoading = ref(false)
/** 打开弹窗时的等级价快照：只有真的改动过才调 saveLevelPrices（整体替换接口） */
const levelPriceBaseline = ref('[]')

const levelPriceColumns = computed<TableColumn<LevelPriceRow>[]>(() => [
  {
    accessorKey: 'levelName',
    header: () => $ts('module.system.goods.levelPrice.levelName')
  },
  {
    accessorKey: 'price',
    header: () => $ts('module.system.goods.levelPrice.price')
  },
  {
    accessorKey: 'remark',
    header: () => $ts('module.system.goods.levelPrice.remark')
  }
])

/** items 只提交「填了价格」的等级，留空等于该等级用基础价 */
const buildLevelItems = (): SysGoodsLevelPriceItemDTO[] => levelRows.value
  .filter(row => Boolean(row.levelId) && row.price !== null)
  .map(row => ({
    levelId: row.levelId,
    price: Number(row.price),
    remark: row.remark || null
  }))

const levelPriceDirty = computed(() => JSON.stringify(buildLevelItems()) !== levelPriceBaseline.value)

const loadLevelPrices = async (goodsId: string) => {
  levelPriceLoading.value = true

  try {
    const [levels, prices] = await Promise.all([
      $trpc.sysGoods.levelOptions.query(),
      $trpc.sysGoods.levelPrices.query({ goodsId })
    ])

    const priceByLevelId = new Map(prices.map(item => [item.levelId ?? '', item] as const))
    const rows: LevelPriceRow[] = levels.map(level => ({
      levelId: level.id,
      levelName: level.name ?? level.id,
      price: toNumberOrNull(priceByLevelId.get(level.id)?.price),
      remark: priceByLevelId.get(level.id)?.remark ?? '',
      disabled: false
    }))

    // 停用等级若还有专属价，也一并回显，否则整体替换会把它静默清掉
    for (const item of prices) {
      const levelId = item.levelId ?? ''

      if (!levelId || rows.some(row => row.levelId === levelId)) {
        continue
      }

      rows.push({
        levelId,
        levelName: item.levelName ?? levelId,
        price: toNumberOrNull(item.price),
        remark: item.remark ?? '',
        disabled: true
      })
    }

    levelRows.value = rows
    levelPriceBaseline.value = JSON.stringify(buildLevelItems())
  } catch {
    // 等级价读不到不阻塞主表单（错误提示已由全局 tRPC 处理器给出）
    levelRows.value = []
    levelPriceBaseline.value = '[]'
  } finally {
    levelPriceLoading.value = false
  }
}

/* ── 打开/关闭与提交 ──────────────────────────────────────────────────── */

const fillFormData = (data: SysGoodsRespDTO) => {
  Object.assign(state.value, {
    id: data.id ?? '',
    name: data.name ?? '',
    subtitle: data.subtitle ?? '',
    cover: data.cover ?? '',
    price: toNumberOrNull(data.price),
    stock: data.stock ?? 0,
    unlimitedStock: data.unlimitedStock === 1 ? 1 : 0,
    // 响应里的 type 是宽松字符串，这里收敛到契约枚举，未知值回落 virtual
    type: (data.type as GoodsDraft['type']) ?? 'virtual',
    serviceNotice: data.serviceNotice ?? '',
    detail: data.detail ?? '',
    sortOrder: data.sortOrder ?? 0,
    status: data.status === 0 ? 0 : 1,
    remark: data.remark ?? ''
  })
}

const initFormData = async () => {
  state.value = emptyDraft()
  levelRows.value = []
  levelPriceBaseline.value = '[]'
  resetUploadState()

  if (props.operateType === 'edit' && props.data) {
    fillFormData(props.data)
  }

  // 编辑态：并行取上传配置与等级价，打开弹窗只等一次往返
  const editingId = props.operateType === 'edit' ? (props.data?.id ?? '') : ''

  await Promise.all([
    canUploadCover.value ? loadUploadConfigs() : Promise.resolve(),
    editingId ? loadLevelPrices(editingId) : Promise.resolve()
  ])
}

watch(visible, (opened) => {
  if (opened) {
    void initFormData()
  }
})

const closeDrawer = () => {
  if (uploading.value) {
    cancelUpload()
  }

  props.close?.()
}

const buildPayload = () => ({
  id: state.value.id,
  name: state.value.name.trim(),
  subtitle: state.value.subtitle.trim() || null,
  cover: state.value.cover.trim() || null,
  price: state.value.price ?? 0,
  stock: state.value.stock ?? 0,
  unlimitedStock: state.value.unlimitedStock,
  type: state.value.type,
  // 服务说明只在服务类商品上保留，切回虚拟/实物时清掉
  serviceNotice: state.value.type === 'service' ? (state.value.serviceNotice.trim() || null) : null,
  detail: state.value.detail || null,
  sortOrder: state.value.sortOrder ?? 0,
  status: state.value.status,
  remark: state.value.remark.trim() || null
})

const handleSubmit = async (_event: FormSubmitEvent<GoodsDraft>) => {
  if (saving.value) {
    return
  }

  saving.value = true

  try {
    const payload = buildPayload()

    if (props.operateType === 'add') {
      // create 只返回布尔值，等级价要等拿到 id 后（再次编辑）才能配
      await $trpc.sysGoods.create.mutate(payload)
      useToastSuccess($ts('common.addSuccess'))
    } else {
      await $trpc.sysGoods.update.mutate(payload)
      useToastSuccess($ts('common.modifySuccess'))
    }

    // 等级价是整体替换接口：没有改动就不调用，避免把停用等级的价格误清
    if (props.operateType === 'edit' && payload.id && levelPriceDirty.value) {
      const count = await $trpc.sysGoods.saveLevelPrices.mutate({
        goodsId: payload.id,
        items: buildLevelItems()
      })

      levelPriceBaseline.value = JSON.stringify(buildLevelItems())
      useToastSuccess($ts('module.system.goods.levelPrice.saveSuccess', { count }))
    }

    closeDrawer()
    await props.refresh?.(payload.id)
  } finally {
    saving.value = false
  }
}

const title = computed(() => {
  const titles: Record<string, string> = {
    add: $ts('module.system.goods.addSysGoods'),
    edit: $ts('module.system.goods.editSysGoods')
  }

  return titles[props.operateType]
})
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="title"
    :dismissible="!uploading && !saving"
    :ui="{
      content: 'w-[calc(100vw-2rem)] max-w-[900px]',
      footer: 'justify-end gap-2 border-t border-default p-4 sm:px-6'
    }"
  >
    <template #body>
      <UForm ref="form" :validate="validateForm" :state="state" class="p-2" @submit="handleSubmit">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-6">
          <UFormField name="name" required :label="$ts('module.system.goods.name')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.name" :placeholder="$ts('module.system.goods.form.name')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="subtitle" :label="$ts('module.system.goods.subtitle')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="state.subtitle" :placeholder="$ts('module.system.goods.form.subtitle')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="price" required :label="$ts('module.system.goods.price')" orientation="horizontal" :ui="formItemUi">
            <UInputNumber
              v-model="state.price"
              :min="0"
              :step="0.01"
              :format-options="{ minimumFractionDigits: 2 }"
              :placeholder="$ts('module.system.goods.form.price')"
              class="w-full"
            />
          </UFormField>
          <UFormField name="type" required :label="$ts('module.system.goods.typeLabel')" orientation="horizontal" :ui="formItemUi">
            <USelect v-model="state.type" :items="typeItems" :placeholder="$ts('module.system.goods.form.type')" class="w-full" />
          </UFormField>
          <UFormField
            name="unlimitedStock"
            :label="$ts('module.system.goods.unlimitedStock')"
            orientation="horizontal"
            :ui="formItemUi"
            :help="state.unlimitedStock === 1 ? $ts('module.system.goods.stockDisabled') : undefined"
          >
            <USwitch v-model="state.unlimitedStock" :true-value="1" :false-value="0" />
          </UFormField>
          <UFormField name="stock" :label="$ts('module.system.goods.stock')" orientation="horizontal" :ui="formItemUi">
            <UInputNumber v-model="state.stock" :min="0" :disabled="state.unlimitedStock === 1" class="w-full" />
          </UFormField>
          <UFormField
            v-if="state.type === 'service'"
            name="serviceNotice"
            :label="$ts('module.system.goods.serviceNotice')"
            orientation="horizontal"
            :ui="formItemUi"
          >
            <UBaseInput v-model="state.serviceNotice" :placeholder="$ts('module.system.goods.form.serviceNotice')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="sortOrder" :label="$ts('module.system.goods.sortOrder')" orientation="horizontal" :ui="formItemUi">
            <UInputNumber v-model="state.sortOrder" :min="0" class="w-full" />
          </UFormField>
          <UFormField name="status" :label="$ts('module.system.goods.statusLabel')" orientation="horizontal" :ui="formItemUi">
            <USwitch v-model="state.status" :true-value="1" :false-value="0" />
          </UFormField>
        </div>

        <UFormField name="cover" :label="$ts('module.system.goods.cover')" orientation="horizontal" :ui="formItemUi" class="mt-6">
          <div class="w-full space-y-3">
            <div class="flex items-start gap-3">
              <div class="w-20 h-20 rounded-md border border-default bg-elevated flex items-center justify-center overflow-hidden flex-shrink-0">
                <img v-if="state.cover" :src="state.cover" :alt="state.name" class="w-full h-full object-cover">
                <UIcon v-else name="i-lucide-image-off" class="size-6 text-muted" />
              </div>

              <div class="min-w-0 flex-1 space-y-2">
                <template v-if="canUploadCover">
                  <UFileUpload
                    v-model="coverFile"
                    accept="image/*"
                    variant="area"
                    layout="list"
                    :multiple="false"
                    :disabled="uploading"
                    :label="$ts('module.system.oss.form.uploadFile')"
                    :description="$ts('module.system.oss.uploadSingleOnly')"
                    class="w-full"
                  />

                  <USelect
                    v-if="uploadConfigItems.length > 1"
                    v-model="uploadConfigId"
                    :items="uploadConfigItems"
                    :loading="loadingUploadConfigs"
                    :disabled="uploading"
                    :placeholder="$ts('module.system.oss.form.uploadConfig')"
                    class="w-full"
                  />

                  <div class="flex flex-wrap items-center gap-2">
                    <UButton
                      type="button"
                      icon="i-lucide-upload"
                      size="sm"
                      :disabled="!canUpload"
                      :loading="uploading"
                      :label="$ts('module.system.oss.upload')"
                      @click="uploadCover"
                    />
                    <UButton
                      v-if="uploading"
                      type="button"
                      color="warning"
                      variant="outline"
                      size="sm"
                      icon="i-lucide-ban"
                      :label="$ts('module.system.oss.cancelUpload')"
                      @click="cancelUpload"
                    />
                    <span v-if="coverFile" class="text-xs text-muted">{{ coverFile.name }}</span>
                  </div>

                  <div v-if="uploading || uploadProgress > 0" class="space-y-1">
                    <div class="flex items-center justify-between text-xs text-muted">
                      <span>{{ uploading ? $ts('module.system.oss.uploading') : $ts('module.system.oss.uploadProgress') }}</span>
                      <span>{{ uploadProgress }}%</span>
                    </div>
                    <UProgress :model-value="uploadProgress" color="primary" />
                  </div>
                </template>

                <UAlert
                  v-else
                  color="warning"
                  variant="soft"
                  icon="i-lucide-circle-alert"
                  :title="$ts('module.system.goods.coverUploadUnavailable')"
                />

                <!-- 上传与手填 URL 二选一：这里始终可以直接粘贴地址 -->
                <UInput v-model="state.cover" type="url" :placeholder="$ts('module.system.goods.form.cover')" class="w-full" />
              </div>
            </div>
          </div>
        </UFormField>

        <UFormField name="detail" :label="$ts('module.system.goods.detail')" orientation="horizontal" :ui="formItemUi" class="mt-6">
          <UTextarea v-model="state.detail" :rows="4" :placeholder="$ts('module.system.goods.form.detail')" class="w-full" />
        </UFormField>

        <UFormField name="remark" :label="$ts('module.system.goods.remark')" orientation="horizontal" :ui="formItemUi" class="mt-6">
          <UTextarea v-model="state.remark" :rows="2" :placeholder="$ts('module.system.goods.form.remark')" class="w-full" />
        </UFormField>

        <USeparator class="my-5" :label="$ts('module.system.goods.levelPrice.title')" />

        <div v-if="operateType === 'edit'" class="space-y-3">
          <UAlert
            color="info"
            variant="soft"
            icon="i-lucide-info"
            :description="$ts('module.system.goods.levelPrice.hint')"
          />

          <UTable
            :data="levelRows"
            :columns="levelPriceColumns"
            :loading="levelPriceLoading"
            :ui="{ base: 'min-w-[560px]', td: 'align-top' }"
          >
            <template #levelName-cell="{ row }">
              <div class="flex items-center gap-2">
                <span>{{ row.original.levelName || row.original.levelId }}</span>
                <UBadge v-if="row.original.disabled" color="neutral" variant="subtle" size="sm">
                  {{ $ts('module.system.goods.levelPrice.levelDisabled') }}
                </UBadge>
              </div>
            </template>

            <template #price-cell="{ row }">
              <UInputNumber
                v-model="row.original.price"
                :min="0"
                :step="0.01"
                :format-options="{ minimumFractionDigits: 2 }"
                :placeholder="$ts('module.system.goods.levelPrice.pricePlaceholder')"
                class="w-full"
              />
            </template>

            <template #remark-cell="{ row }">
              <UBaseInput v-model="row.original.remark" :placeholder="$ts('module.system.goods.levelPrice.form.remark')" trailing="clear" class="w-full" />
            </template>
          </UTable>

          <UAlert
            v-if="!levelPriceLoading && levelRows.length === 0"
            color="neutral"
            variant="soft"
            icon="i-lucide-medal"
            :title="$ts('module.system.goods.levelPrice.empty')"
          />
        </div>

        <UAlert
          v-else
          color="neutral"
          variant="soft"
          icon="i-lucide-info"
          :title="$ts('module.system.goods.levelPrice.addHint')"
        />

        <USeparator class="my-5" />
        <div class="flex justify-end gap-2">
          <UButton :label="$ts('common.cancel')" color="neutral" variant="subtle" :disabled="saving" @click="closeDrawer" />
          <UButton :label="$ts('common.confirm')" color="primary" type="submit" :loading="saving" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
