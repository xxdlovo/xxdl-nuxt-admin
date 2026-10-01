<!--
  扫码支付组件（ScanPay）

  职责：解析渠道 → 调用统一下单 → 展示二维码 / 支付链接 → 轮询或主动查询推进状态。
  对外只暴露「金额 + 渠道（可留空）」这两个必填/常用参数，其余都可留空走默认值。

  ── 用法 ────────────────────────────────────────────────────────────────
  最简：用默认渠道、默认标题、默认 5 秒轮询
      <ScanPay :amount="0.01" auto-start />

  指定渠道（渠道名 / 渠道 id / 渠道渠道码 三者都可以）：
      <ScanPay :amount="1" channel="虎皮椒_支付宝" auto-start />

  受控用法：拿到订单对象与支付成功事件，其余参数全部自定义
      <ScanPay
        v-model:order="order"
        :amount="9.9"
        channel="虎皮椒_支付宝"
        out-trade-no="ORDER20261001001"
        subject="会员充值"
        attach="userId=123"
        notify-url="https://example.com/api/pay/notify/xunhupay"
        :poll-interval="3000"
        :poll-timeout="600000"
        @created="onCreated"
        @success="onPaid"
        @error="onError"
      />

  ── 行为约定 ────────────────────────────────────────────────────────────
  - channel 留空 → 取库中的默认渠道（is_default = 1，其次 sort_order 最小的启用渠道）；
  - 没有渠道 / channel 留空且没有默认渠道 / channel 指定了但匹配不到 → 组件内直接报错，不会发起下单；
  - 渠道 verify_status !== 1（没做过或没通过「测试配置」）→ 报错并提示先去验证；
    服务端 sysPayTest.create 有同样的拦截，组件这里只是提前给出更友好的文案；
  - amount 必须是大于 0 的数字（元，内部按两位小数提交）；不合法时直接报错；
  - outTradeNo 留空 → 后端生成（PAY + 时间戳 + 随机码）；重复的订单号会被唯一索引拒绝；
  - pollInterval <= 0 → 不自动轮询，只能手动点「查询状态」；
  - 自动轮询连续失败 3 次或超过 pollTimeout 会停止并 emit('error')，避免无限请求。
-->
<script setup lang="ts">
import type { SysPayTestStatusDTO } from '#shared/system/payTest'
import { payOrderStatusConfig } from '#shared/constants/business'
import { badgeColorClasses } from '~/composables/badgeColorClasses'
import { useToastSuccess } from '~/utils/toast'

/** channels 查询返回的渠道项（可公开字段，不含任何密钥） */
type ScanPayChannel = {
  id: string
  configName: string
  channelCode: string
  mode: string
  currency: string
  isDefault: number
  verifyStatus: number | null
  notifyUrl: string | null
}

const props = withDefaults(defineProps<{
  /** 支付金额（元）。必填，但类型上允许字符串，便于直接绑定表单输入 */
  amount: number | string
  /** 渠道名（config_name）/ 渠道 id / 渠道编码；留空取默认渠道 */
  channel?: string
  /** 指定商户订单号；留空由后端生成 */
  outTradeNo?: string
  /** 商品标题；留空用「扫码支付」 */
  subject?: string
  /** 业务备注（透传给渠道的 attach） */
  attach?: string
  /** 本次下单的回调地址覆盖值；留空用渠道配置，渠道也为空则按请求地址推导 */
  notifyUrl?: string
  /**
   * 业务类型；留空默认 `test`。
   * 接正式业务请显式传入（例如 recharge）——只有 test 订单允许「模拟支付成功」。
   */
  bizType?: string
  /** 轮询间隔（毫秒）；<= 0 表示不自动轮询 */
  pollInterval?: number
  /** 轮询最长时长（毫秒），超过后停止并报错 */
  pollTimeout?: number
  /** 挂载后自动下单 */
  autoStart?: boolean
  /**
   * 收款平台标识：
   * - `auto`（默认）按渠道名 + 二维码/支付链接自动推断（网关地址里通常带 /alipay/ 或 /wechat/）；
   * - 显式传 `alipay` / `wechat` 时强制使用对应平台的品牌外框与图标。
   * 说明：平台信息只影响「展示」（外框配色 + 官方图标 + 平台名），不影响下单参数。
   */
  platform?: 'auto' | 'alipay' | 'wechat'
  /** 是否展示订单号 / 金额 / 时间等明细 */
  showOrderInfo?: boolean
  /**
   * 是否展示组件内置的「生成二维码」按钮。
   * 使用方自己有提交按钮时传 false，避免两个按钮做同一件事（仍可用 ref.create() 触发）。
   */
  showTrigger?: boolean
}>(), {
  channel: '',
  outTradeNo: '',
  subject: '',
  attach: '',
  notifyUrl: '',
  bizType: '',
  pollInterval: 5000,
  pollTimeout: 10 * 60 * 1000,
  autoStart: false,
  platform: 'auto',
  showOrderInfo: true,
  showTrigger: true
})

/** 平台展示元数据：图标来自项目已内置的 simple-icons 集合，无需额外依赖 */
const PLATFORM_META = {
  alipay: {
    icon: 'i-simple-icons-alipay',
    labelKey: 'module.system.scanPay.platform.alipay',
    accent: 'text-[#1677FF]',
    frame: 'border-[#1677FF]/40 bg-[#1677FF]/5'
  },
  wechat: {
    icon: 'i-simple-icons-wechat',
    labelKey: 'module.system.scanPay.platform.wechat',
    accent: 'text-[#07C160]',
    frame: 'border-[#07C160]/40 bg-[#07C160]/5'
  }
} as const

const emit = defineEmits<{
  /** 下单成功（拿到订单快照，状态通常是 WP） */
  created: [order: SysPayTestStatusDTO]
  /** 状态发生变化（轮询或主动查询导致） */
  'status-change': [order: SysPayTestStatusDTO, previousStatus: string | null]
  /** 订单变为已支付 */
  success: [order: SysPayTestStatusDTO]
  /** 出错：渠道解析失败、下单失败、轮询超时等，message 已本地化，可直接展示 */
  error: [message: string]
}>()

/** 订单快照：支持 v-model:order，父组件可以自由读取状态 */
const order = defineModel<SysPayTestStatusDTO | null>('order', { default: null })

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const channels = ref<ScanPayChannel[]>([])
const resolvedChannel = ref<ScanPayChannel | null>(null)
const errorMessage = ref<string | null>(null)
const loading = ref(false)
const syncing = ref(false)
const polling = ref(false)

const formItemUi = {
  root: 'items-start',
  labelWrapper: 'w-24 shrink-0 pt-1',
  container: 'min-w-0 flex-1'
}

const statusBadge = computed(() => {
  const item = order.value?.status ? payOrderStatusConfig[order.value.status] : undefined

  if (!item) {
    return { label: order.value?.status || '-', class: badgeColorClasses.neutral }
  }

  return { label: $ts(item.i18nKey), class: badgeColorClasses[item.color] || badgeColorClasses.neutral }
})

/** 公网可达性提醒：localhost / 内网 / http 都收不到渠道的异步回调 */
const notifyUrlWarning = computed(() => {
  const url = order.value?.notifyUrl

  if (!url) {
    return true
  }

  if (url.startsWith('http://')) {
    return true
  }

  return /(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|\.local)/i.test(url)
})

/** 从渠道名、渠道编码、二维码/支付链接里推断平台（网关地址一般带 /alipay/ 或 /wechat/） */
function inferPlatform(): 'alipay' | 'wechat' | null {
  const haystack = [
    resolvedChannel.value?.configName,
    resolvedChannel.value?.channelCode,
    order.value?.qrImageUrl,
    order.value?.payUrl,
    order.value?.subject
  ].filter(Boolean).join(' ').toLowerCase()

  if (/alipay|支付宝/.test(haystack)) {
    return 'alipay'
  }
  if (/wechat|weixin|wxpay|微信/.test(haystack)) {
    return 'wechat'
  }

  return null
}

/** 生效的平台：显式传入优先，否则自动推断 */
const resolvedPlatform = computed<'alipay' | 'wechat' | null>(() => {
  if (props.platform !== 'auto') {
    return props.platform
  }

  return inferPlatform()
})

const platformMeta = computed(() => (resolvedPlatform.value ? PLATFORM_META[resolvedPlatform.value] : null))

function setError(message: string) {
  errorMessage.value = message
  emit('error', message)
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

/** 金额归一：非法值返回空串，由调用方报错 */
function normalizeAmount(value: number | string) {
  const amount = Number(value)

  if (!Number.isFinite(amount) || amount <= 0) {
    return ''
  }

  return amount.toFixed(2)
}

/**
 * 渠道匹配：优先渠道名，其次渠道 id，最后渠道编码。
 * wanted 为空时取默认渠道（is_default = 1）。
 */
function matchChannel(list: ScanPayChannel[], wanted: string): ScanPayChannel | null {
  const key = wanted.trim()

  if (!key) {
    return list.find(item => item.isDefault === 1) ?? null
  }

  return list.find(item => item.configName === key)
    ?? list.find(item => item.id === key)
    ?? list.find(item => item.channelCode === key)
    ?? null
}

/** 解析并校验渠道，失败直接抛错（消息已本地化） */
async function resolveChannel(): Promise<ScanPayChannel> {
  if (channels.value.length === 0) {
    channels.value = await $trpc.sysPayTest.channels.query()
  }

  const matched = matchChannel(channels.value, props.channel)

  if (!matched) {
    throw new Error(props.channel.trim()
      ? $ts('module.system.scanPay.channelNotFound', { channel: props.channel })
      : $ts('module.system.scanPay.noDefaultChannel'))
  }

  // 未通过「测试配置」的渠道无法下单（服务端 sysPayTest.create 也会拦截，这里提前给出可读文案）
  if (matched.verifyStatus !== 1) {
    throw new Error($ts('module.system.scanPay.channelNotVerified', { channel: matched.configName }))
  }

  resolvedChannel.value = matched
  return matched
}

/** 统一的订单写入：负责状态变化事件与支付成功事件 */
function applyOrder(next: SysPayTestStatusDTO | null) {
  const previousStatus = order.value?.status ?? null
  order.value = next

  if (!next) {
    return
  }

  if (previousStatus !== next.status) {
    emit('status-change', next, previousStatus)
  }

  if (previousStatus !== 'OD' && next.status === 'OD') {
    emit('success', next)
  }
}

// ── 轮询 ───────────────────────────────────────────────────────────────
let pollTimer: ReturnType<typeof setTimeout> | null = null
let pollStartedAt = 0
let pollFailures = 0

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
  polling.value = false
}

/** 主动查询一次（会真的向渠道查询并推进本地状态） */
async function syncStatus() {
  if (!order.value?.id) {
    return
  }

  syncing.value = true
  try {
    applyOrder(await $trpc.sysPayTest.syncStatus.mutate({ id: order.value.id }))
  } finally {
    syncing.value = false
  }
}

function scheduleNextPoll() {
  pollTimer = setTimeout(async () => {
    if (!order.value?.id) {
      stopPolling()
      return
    }

    if (Date.now() - pollStartedAt > props.pollTimeout) {
      stopPolling()
      setError($ts('module.system.scanPay.pollTimeout'))
      return
    }

    try {
      await syncStatus()
      pollFailures = 0
    } catch {
      // 偶发失败（网络抖动/平台限流）不立即停，连续失败 3 次才提示并停止
      pollFailures += 1

      if (pollFailures >= 3) {
        stopPolling()
        setError($ts('module.system.scanPay.pollFailed'))
        return
      }
    }

    if (order.value?.status === 'WP') {
      scheduleNextPoll()
    } else {
      stopPolling()
    }
  }, Math.max(props.pollInterval, 1000))
}

function startPolling() {
  stopPolling()

  if (props.pollInterval <= 0) {
    return
  }

  polling.value = true
  pollStartedAt = Date.now()
  pollFailures = 0
  scheduleNextPoll()
}

// ── 下单 / 复制 ────────────────────────────────────────────────────────
async function create() {
  errorMessage.value = null
  stopPolling()

  const amount = normalizeAmount(props.amount)

  if (!amount) {
    setError($ts('module.system.scanPay.amountRequired'))
    return
  }

  loading.value = true

  try {
    const channel = await resolveChannel()
    const created = await $trpc.sysPayTest.create.mutate({
      channelId: channel.id,
      amount,
      subject: props.subject.trim() || $ts('module.system.scanPay.title'),
      attach: props.attach.trim() || undefined,
      notifyUrl: props.notifyUrl.trim() || undefined,
      outTradeNo: props.outTradeNo.trim() || undefined,
      bizType: props.bizType.trim() || undefined
    })

    applyOrder(created)
    emit('created', created)

    if (created.status === 'WP') {
      startPolling()
    }
  } catch (error) {
    applyOrder(null)
    setError(toMessage(error))
  } finally {
    loading.value = false
  }
}

async function copyQrContent() {
  if (!order.value?.qrContent) {
    return
  }

  try {
    await navigator.clipboard.writeText(order.value.qrContent)
    useToastSuccess($ts('common.copySuccess'))
  } catch {
    setError($ts('module.system.payTest.copyFailed'))
  }
}

onMounted(() => {
  if (props.autoStart) {
    void create()
  }
})

onBeforeUnmount(stopPolling)

/** 供父组件通过 ref 主动调用：create() 下单、syncStatus() 主动查询、stop() 停止轮询 */
defineExpose({ create, syncStatus, stop: stopPolling })
</script>

<template>
  <UCard :ui="{ body: 'space-y-4' }">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-qr-code" />
          <span>{{ $ts('module.system.scanPay.title') }}</span>
          <UBadge v-if="resolvedChannel" color="neutral" variant="subtle" size="sm">
            {{ resolvedChannel.configName }}
          </UBadge>
        </div>

        <span v-if="polling" class="text-xs text-muted inline-flex items-center gap-1">
          <UIcon name="i-lucide-loader-circle" class="animate-spin" />
          {{ $ts('module.system.payTest.polling') }}
        </span>
      </div>
    </template>

    <!-- 出错：渠道解析失败 / 下单失败 / 轮询超时，都给出可读文案与重试入口 -->
    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="$ts('module.system.scanPay.failed')"
      :description="errorMessage"
    />

    <!-- 首次下单中 -->
    <div v-else-if="loading && !order" class="py-10 text-center text-sm text-muted">
      <UIcon name="i-lucide-loader-circle" class="animate-spin mr-1" />
      {{ $ts('module.system.scanPay.generating') }}
    </div>

    <!-- 尚未下单 -->
    <div v-else-if="!order" class="py-10 text-center text-sm text-muted">
      {{ $ts('module.system.scanPay.idle') }}
    </div>

    <!-- 订单信息 + 二维码 -->
    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border" :class="statusBadge.class">
          {{ statusBadge.label }}
        </span>
        <span class="text-xs text-muted">{{ order.providerStatus || '-' }}</span>
        <span v-if="order.paidAt" class="text-xs text-muted">{{ order.paidAt }}</span>
      </div>

      <div v-if="showOrderInfo" class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        <UFormField :label="$ts('module.system.payTest.outTradeNo')" orientation="horizontal" :ui="formItemUi">
          <UInput :model-value="order.outTradeNo" readonly color="neutral" variant="subtle" class="w-full" :ui="{ base: 'break-all' }" />
        </UFormField>
        <UFormField :label="$ts('module.system.payTest.amount')" orientation="horizontal" :ui="formItemUi">
          <UInput :model-value="`${order.amount} ${order.currency}`" readonly color="neutral" variant="subtle" class="w-full" />
        </UFormField>
        <UFormField :label="$ts('module.system.payTest.subject')" orientation="horizontal" :ui="formItemUi">
          <UInput :model-value="order.subject" readonly color="neutral" variant="subtle" class="w-full" :ui="{ base: 'break-all' }" />
        </UFormField>
        <UFormField :label="$ts('module.system.payTest.expireAt')" orientation="horizontal" :ui="formItemUi">
          <UInput :model-value="order.expireAt || '-'" readonly color="neutral" variant="subtle" class="w-full" />
        </UFormField>
      </div>

      <UAlert
        v-if="notifyUrlWarning"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="$ts('module.system.payTest.notifyUrlWarning')"
        :description="order.notifyUrl || ''"
      />

      <!-- 二维码区：识别到平台（或显式指定）时，套一层对应平台的品牌外框 -->
      <div class="flex flex-col items-center gap-2">
        <div
          class="rounded-xl border-2 px-4 py-3 flex flex-col items-center gap-2"
          :class="platformMeta ? platformMeta.frame : 'border-default'"
        >
          <div v-if="platformMeta" class="flex items-center gap-1.5">
            <UIcon :name="platformMeta.icon" class="w-5 h-5" :class="platformMeta.accent" />
            <span class="text-sm font-medium" :class="platformMeta.accent">
              {{ $ts(platformMeta.labelKey) }}
            </span>
          </div>

          <img
            v-if="order.qrImageUrl"
            :src="order.qrImageUrl"
            alt="pay qrcode"
            class="max-w-[220px] rounded-md bg-white p-1"
          >

          <template v-else-if="order.qrContent">
            <UTextarea
              :model-value="order.qrContent"
              readonly
              autoresize
              :rows="2"
              color="neutral"
              variant="subtle"
              class="w-full font-mono text-xs"
            />
            <div class="text-xs text-muted">{{ $ts('module.system.payTest.qrContentTip') }}</div>
            <UButton size="xs" variant="outline" icon="i-lucide-copy" @click="copyQrContent">
              {{ $ts('common.copy') }}
            </UButton>
          </template>

          <div v-else class="text-xs text-muted">
            {{ order.payUrl ? $ts('module.system.payTest.noQrcode') : $ts('module.system.payTest.noQrcodeNoUrl') }}
          </div>
        </div>

        <div v-if="platformMeta && order.qrImageUrl" class="text-xs text-muted">
          {{ $ts('module.system.scanPay.scanTip', { platform: $ts(platformMeta.labelKey) }) }}
        </div>

        <UButton
          v-if="order.payUrl"
          :to="order.payUrl"
          target="_blank"
          size="sm"
          variant="link"
          icon="i-lucide-external-link"
        >
          {{ $ts('module.system.payTest.openPayUrl') }}
        </UButton>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <!-- 额外操作由使用方注入（例如测试页的「模拟支付成功」） -->
        <slot name="actions" :order="order" :create="create" :sync="syncStatus" :syncing="syncing" />
        <UButton
          v-if="order.status === 'WP'"
          variant="outline"
          color="neutral"
          icon="i-lucide-refresh-cw"
          :loading="syncing"
          @click="syncStatus"
        >
          {{ $ts('module.system.payTest.syncStatus') }}
        </UButton>
        <UButton
          variant="outline"
          color="primary"
          icon="i-lucide-qr-code"
          :loading="loading"
          @click="create"
        >
          {{ $ts('module.system.scanPay.retry') }}
        </UButton>
      </div>
    </template>

    <!-- 空态下的下单入口（使用方自带提交按钮时可关掉） -->
    <div v-if="showTrigger && !order && !loading" class="flex justify-center">
      <UButton color="primary" icon="i-lucide-qr-code" :loading="loading" @click="create">
        {{ $ts('module.system.scanPay.generate') }}
      </UButton>
    </div>
  </UCard>
</template>
