<template>
  <div class="h-full p-3">
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <!-- 左：下单参数。二维码、状态、轮询全部交给 ScanPay 组件，这里只负责收集参数 -->
      <UCard :ui="{ body: 'space-y-4' }">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-sliders-horizontal" />
            <span>{{ $ts('module.system.payTest.title') }}</span>
          </div>
        </template>

        <UAlert
          v-if="channels.length === 0"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="$ts('module.system.payTest.noChannel')"
          :description="$ts('module.system.payTest.noChannelTip')"
        />

        <UForm v-else :state="form" class="space-y-4" @submit="createQrCode">
          <UFormField name="channelId" :label="$ts('module.system.payTest.channel')" orientation="horizontal" :ui="formItemUi">
            <USelect v-model="channelValue" :items="channelItems" class="w-full" />
          </UFormField>
          <UFormField name="amount" required :label="$ts('module.system.payTest.amount')" orientation="horizontal" :ui="formItemUi">
            <UInputNumber v-model="form.amount" :min="0.01" :max="99999999.99" :step="0.01" :format-options="{ minimumFractionDigits: 2 }" class="w-full" />
          </UFormField>
          <UFormField name="subject" required :label="$ts('module.system.payTest.subject')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="form.subject" :placeholder="$ts('module.system.payTest.form.subject')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="attach" :label="$ts('module.system.payTest.attach')" orientation="horizontal" :ui="formItemUi">
            <UBaseInput v-model="form.attach" :placeholder="$ts('module.system.payTest.form.attach')" trailing="clear" class="w-full" />
          </UFormField>
          <UFormField name="notifyUrl" :label="$ts('module.system.payTest.notifyUrl')" orientation="horizontal" :ui="formItemUi" :help="$ts('module.system.payTest.notifyUrlHelp')">
            <UBaseInput v-model="form.notifyUrl" :placeholder="$ts('module.system.payTest.form.notifyUrl')" trailing="clear" class="w-full" />
          </UFormField>

          <div class="flex justify-end gap-2">
            <UButton type="submit" color="primary" icon="i-lucide-qr-code" :loading="creating">
              {{ $ts('module.system.payTest.submit') }}
            </UButton>
          </div>
        </UForm>
      </UCard>

      <!-- 右：扫码支付组件。渠道名留空时组件内部取默认渠道 -->
      <ScanPay
        ref="scanPayRef"
        v-model:order="order"
        :amount="form.amount"
        :channel="selectedChannelName"
        :subject="form.subject"
        :attach="form.attach"
        :notify-url="form.notifyUrl"
        :poll-interval="5000"
        :show-trigger="false"
        @created="creating = false"
        @success="handlePaid"
        @error="handleComponentError"
      >
        <!-- 额外操作：把「模拟支付成功」这类测试专用按钮注入组件 -->
        <template #actions="{ order: current }">
          <UButton
            v-if="current && current.status === 'WP'"
            variant="outline"
            color="success"
            icon="i-lucide-circle-check"
            :loading="simulating"
            :disabled="!canSimulate || !current.simulateEnabled || !current.simulateSupported"
            @click="handleSimulate(current.id)"
          >
            {{ $ts('module.system.payTest.simulatePaid') }}
          </UButton>
        </template>
      </ScanPay>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '扫码支付测试',
  icon: 'i-lucide-qr-code'
})

import type { SysPayTestStatusDTO } from '#shared/system/payTest'
import { useToastError, useToastSuccess } from '~/utils/toast'

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()
const { isAdmin, hasPermission } = useRbacProfile()

const formItemUi = {
  root: 'flex items-center',
  label: 'w-28 text-right pr-2 flex-shrink-0',
  container: 'flex-1'
}

/** 只有拥有模拟权限的人才能用「模拟支付成功」（服务端还会校验环境开关与订单类型） */
const canSimulate = computed(() => isAdmin.value || hasPermission('system:payTest:simulate'))

const channels = ref<Array<{
  id: string
  configName: string
  channelCode: string
  currency: string
  isDefault: number
  verifyStatus: number | null
  notifyUrl: string | null
}>>([])
const order = ref<SysPayTestStatusDTO | null>(null)
const creating = ref(false)
const simulating = ref(false)
const scanPayRef = useTemplateRef('scanPayRef')

const form = ref({
  channelId: '',
  amount: 0.01,
  subject: '扫码支付测试',
  attach: '',
  notifyUrl: ''
})

const channelItems = computed(() => channels.value.map(channel => ({
  value: channel.id,
  label: `${channel.configName}（${channel.channelCode} · ${channel.currency}）`
})))

const channelValue = computed({
  get: () => form.value.channelId,
  set: value => form.value.channelId = value
})

/**
 * 传给组件的渠道标识：优先用渠道名（组件支持渠道名/ID/编码）。
 * 留空时组件会自己取默认渠道，所以这里允许空串。
 */
const selectedChannelName = computed(() =>
  channels.value.find(channel => channel.id === form.value.channelId)?.configName ?? ''
)

const loadChannels = async () => {
  channels.value = await $trpc.sysPayTest.channels.query()
  const preferred = channels.value.find(channel => channel.isDefault) ?? channels.value[0]

  if (preferred && !form.value.channelId) {
    form.value.channelId = preferred.id
  }
}

/** 表单提交 → 交给组件的 create()（组件会解析渠道、下单、开始轮询） */
const createQrCode = async () => {
  if (!form.value.channelId) {
    useToastError($ts('module.system.payTest.noChannel'))
    return
  }

  creating.value = true
  await scanPayRef.value?.create()
  creating.value = false
}

const handlePaid = () => {
  useToastSuccess($ts('module.system.payTest.paidSuccess'))
}

const handleComponentError = (message: string) => {
  creating.value = false
  useToastError($ts('module.system.payOrder.createFailed'), undefined, message)
}

const handleSimulate = async (id: string) => {
  simulating.value = true

  try {
    const result = await $trpc.sysPayTest.simulatePaid.mutate({ id })
    order.value = result.order
    useToastSuccess($ts('module.system.payTest.simulateDone'), undefined, result.processResult)
  } finally {
    simulating.value = false
  }
}

onMounted(async () => {
  await loadChannels()
})
</script>
