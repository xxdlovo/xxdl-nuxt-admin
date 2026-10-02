<script setup lang="ts">
import type { SysMemberFreezeDto } from '#shared/system/memberFreeze'
import { memberFreezeStatusConfig } from '#shared/constants/business'
import { badgeColorClasses } from '~/composables/badgeColorClasses'

const props = defineProps<{
  visible: boolean
  data?: SysMemberFreezeDto | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const visible = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

/** 打开弹窗时按 id 拉一次最新单据；拿不到就退回列表行数据，避免弹窗空白 */
const latest = ref<SysMemberFreezeDto | null>(null)
const loading = ref(false)

const detail = computed(() => latest.value ?? props.data ?? null)

const displayValue = (value: unknown) => {
  if (value == null || value === '') {
    return '-'
  }

  return String(value)
}

/** 状态彩色标签，复用 shared 常量里的徽标配置 */
const statusBadge = computed(() => {
  const status = detail.value?.status
  const config = status ? memberFreezeStatusConfig[status] : undefined

  if (!config) {
    return { label: status || '-', class: badgeColorClasses.neutral }
  }

  return {
    label: $ts(config.i18nKey),
    class: badgeColorClasses[config.color] || badgeColorClasses.neutral
  }
})

const detailItems = computed(() => {
  const item = detail.value

  return [
    { label: $ts('module.system.memberFreeze.bizNo'), value: item?.bizNo },
    { label: $ts('module.system.memberFreeze.userId'), value: item?.userId },
    { label: $ts('module.system.memberFreeze.amount'), value: item?.amount },
    { label: $ts('module.system.memberFreeze.giftAmount'), value: item?.giftAmount },
    { label: $ts('module.system.memberFreeze.rechargeAmount'), value: item?.rechargeAmount },
    { label: $ts('module.system.memberFreeze.subject'), value: item?.subject },
    { label: $ts('module.system.memberFreeze.attach'), value: item?.attach },
    { label: $ts('module.system.memberFreeze.createdAt'), value: item?.createdAt },
    { label: $ts('module.system.memberFreeze.expireAt'), value: item?.expireAt },
    { label: $ts('module.system.memberFreeze.confirmedAt'), value: item?.confirmedAt },
    { label: $ts('module.system.memberFreeze.releasedAt'), value: item?.releasedAt },
    { label: $ts('module.system.memberFreeze.releaseReason'), value: item?.releaseReason },
    { label: $ts('module.system.memberFreeze.updatedAt'), value: item?.updatedAt },
    { label: $ts('module.system.memberFreeze.remark'), value: item?.remark }
  ]
})

const loadDetail = async () => {
  const id = props.data?.id

  latest.value = null

  if (!id) {
    return
  }

  loading.value = true
  try {
    latest.value = await $trpc.sysMemberFreeze.getById.query(id) as SysMemberFreezeDto
  } catch {
    // 详情接口失败（例如单据已被删除）时退回列表行数据，错误提示由全局 tRPC 链路给出
    latest.value = null
  } finally {
    loading.value = false
  }
}

watch(visible, (opened) => {
  if (opened) {
    void loadDetail()
  }
})
</script>

<template>
  <UModal
    v-model:open="visible"
    :title="$ts('module.system.memberFreeze.detailTitle')"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[900px]', footer: 'justify-end' }"
  >
    <template #body>
      <div v-if="detail" class="space-y-4">
        <div class="flex items-center gap-3">
          <span class="text-sm text-muted">{{ $ts('module.system.memberFreeze.statusLabel') }}</span>
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border" :class="statusBadge.class">
            {{ statusBadge.label }}
          </span>
          <UIcon v-if="loading" name="i-lucide-loader-circle" class="animate-spin text-muted" />
        </div>

        <UCard variant="subtle" :ui="{ body: 'space-y-4' }">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <UFormField
              v-for="item in detailItems"
              :key="item.label"
              :label="item.label"
              orientation="horizontal"
              :ui="{ root: 'items-start', labelWrapper: 'w-28 shrink-0 pt-1', container: 'min-w-0 flex-1' }"
            >
              <UInput
                :model-value="displayValue(item.value)"
                readonly
                color="neutral"
                variant="subtle"
                class="w-full"
                :ui="{ base: 'break-all' }"
              />
            </UFormField>
          </div>
        </UCard>
      </div>
    </template>

    <template #footer>
      <UButton color="neutral" variant="subtle" @click="visible = false">
        {{ $ts('common.close') }}
      </UButton>
    </template>
  </UModal>
</template>
