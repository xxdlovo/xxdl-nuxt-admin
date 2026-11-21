<script setup lang="ts">
import { useToastError, useToastSuccess, useToastWarning } from '#admin/app/utils/toast'

/**
 * 能力与配额演示页。
 *
 * 关键约定：
 * - 能力项的「名字 / 类型 / 是否隐藏」只信服务端 `state.visible`（服务端已按
 *   `hiddenFeatures` 与 `meta.userShow === false` 过滤），页面不自己读 store 里的 meta，
 *   避免展示口径和接口口径漂移；
 * - 具体数值（能不能用、上限、剩余）用 `useEntitlement()`，它与后端守卫共用
 *   `#admin/shared/entitlement/types` 里的纯函数；
 * - 所有写操作都真正落到服务端的 assertEntitlement，前端 v-feature 只影响体验。
 */
definePageMeta({
  layout: 'system',
  title: '能力与配额演示',
  icon: 'i-lucide-toy-brick'
})

type ShowcaseClass = {
  id: string
  userId: string
  name: string
  createdAt: string
}

type VisibleEntitlement = {
  key: string
  name: string
  kind: 'switch' | 'quota'
  value: number
  unlimited: boolean
}

type ShowcaseUsed = {
  classCount: number
  hiddenCount: number
}

type StateResponse = {
  classes: ShowcaseClass[]
  used: ShowcaseUsed
  visible: VisibleEntitlement[]
  levelName: string | null
}

/** 最近一次请求的结果，用来对比「配额 / 开关 / 隐藏」三种拦截的差异 */
type LastResult = {
  label: string
  ok: boolean
  status: number | null
  message: string
  hint: string
}

type ApiErrorBody = {
  statusCode?: number
  statusMessage?: string
  message?: string
  data?: { statusCode?: number, statusMessage?: string, message?: string }
}

const STATE_URL = '/api/showcase/entitlement/state'
const CLASSES_URL = '/api/showcase/entitlement/classes'
const HIDDEN_URL = '/api/showcase/entitlement/hidden'
const EXPORT_URL = '/api/showcase/entitlement/export'

/** 三个能力键：与能力目录（sys_member_feature.feature_key）逐字一致 */
const CLASS_QUOTA_KEY = 'demo.class.max'
const REPORT_SWITCH_KEY = 'demo.report.export'

const { profile, can, quota, remaining, isHidden, isUnlimited, levelName } = useEntitlement()

const state = ref<StateResponse | null>(null)
const loading = ref(true)
const className = ref('')
const creating = ref(false)
const removingId = ref<string | null>(null)
const hiddenCreating = ref(false)
const exporting = ref(false)
const lastResult = ref<LastResult | null>(null)

/** 已用量：接口返回，和计量器读的是同一份内存数据 */
const classUsed = computed(() => state.value?.used.classCount ?? 0)

/** 班级配额的上限 / 剩余 / 是否不限，全部走 useEntitlement（与后端同源纯函数） */
const classLimit = computed(() => quota(CLASS_QUOTA_KEY))
const classUnlimited = computed(() => isUnlimited(CLASS_QUOTA_KEY))
const classRemaining = computed(() => remaining(CLASS_QUOTA_KEY, classUsed.value))
/** profile 尚未加载时不要谎报「配额用尽」（此时 quota 一律按 0） */
const classExhausted = computed(() => !!profile.value && !classUnlimited.value && (classRemaining.value ?? 0) <= 0)

/** 导出开关的实时状态（与 v-feature 同一个判定来源），用于对照说明 */
const reportExportOn = computed(() => can(REPORT_SWITCH_KEY))

/** 面板里要用到的「已知已用量」；未知的配额只展示上限，不瞎猜已用 */
const knownUsed = computed<Record<string, number>>(() => ({
  [CLASS_QUOTA_KEY]: classUsed.value
}))

/**
 * 面板能力项：来自接口 state.visible，再用 isHidden 兜一层
 * （隐藏键理论上不会出现，这里保留二次过滤，防止接口口径回退）。
 */
const visibleItems = computed(() => (state.value?.visible ?? []).filter(item => !isHidden(item.key)))

function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function limitText(key: string): string {
  return isUnlimited(key) ? '不限' : String(quota(key))
}

function usedText(key: string): string | null {
  const used = knownUsed.value[key]
  return typeof used === 'number' ? String(used) : null
}

/** 面板里单项的数值文案：开关显示开关态，配额显示「已用 x / 上限 n」或「上限 n」 */
function itemValueText(item: VisibleEntitlement): string {
  if (item.kind === 'switch') {
    return can(item.key) ? '已开启' : '已关闭'
  }

  const used = usedText(item.key)

  return used === null
    ? `上限 ${limitText(item.key)}`
    : `已用 ${used} / 上限 ${limitText(item.key)}`
}

/** 从 ofetch 的异常里取状态码与已翻译好的服务端文案 */
function readApiError(error: unknown): { status: number | null, message: string } {
  const err = (error ?? {}) as ApiErrorBody

  return {
    status: err.statusCode ?? err.data?.statusCode ?? null,
    message: err.data?.message ?? err.data?.statusMessage ?? err.statusMessage ?? err.message ?? '请求失败'
  }
}

/**
 * 失败归类：三种演示效果的区别都体现在这里。
 * 服务端对「配额用尽 / 开关关闭 / 隐藏项」都用 403，所以只能靠触发入口 + 文案判断：
 * - 配额用尽（user_show = 1）：文案里带具体上限；
 * - 开关关闭 / 隐藏项（user_show = 0）：只有通用文案「当前操作不可用」。
 */
function classifyHint(action: 'class' | 'export' | 'hidden' | 'state' | 'remove', message: string): string {
  const generic = message.includes('当前操作不可用')

  if (action === 'class') {
    return generic
      ? '配额拦截：服务端按「已用 + 1 > 上限」拒绝，但该能力没有可见上限（未登记 / 上限为 0），所以只有通用文案'
      : '配额拦截：服务端算了「已用 + 1」超过上限才拒绝；v-feature 只是把按钮置灰，绕过前端也进不来'
  }

  if (action === 'export') {
    return '开关拦截：v-feature 已把「导出报表」从 DOM 移除；这里能失败说明是直接调接口绕过了前端，服务端仍然 403'
  }

  if (action === 'hidden') {
    return '隐藏配额拦截：user_show = 0，拒绝文案固定为通用提示，响应体与报错里都不出现功能名与上限'
  }

  return '登录态或服务端异常：与配额无关，请按提示排查'
}

function recordFailure(action: 'class' | 'export' | 'hidden' | 'state' | 'remove', label: string, error: unknown): void {
  const { status, message } = readApiError(error)

  lastResult.value = {
    label,
    ok: false,
    status,
    message,
    hint: classifyHint(action, message)
  }
}

/** 当前能力里班级配额的展示文案 */
const classUsageText = computed(() => {
  return classUnlimited.value
    ? `已用 ${classUsed.value} / 不限`
    : `已用 ${classUsed.value} / 上限 ${classLimit.value}`
})

async function refreshState(): Promise<void> {
  loading.value = true

  try {
    state.value = await $fetch<StateResponse>(STATE_URL)
  }
  catch (error) {
    recordFailure('state', '加载演示状态', error)
    useToastError('加载失败', 5000, readApiError(error).message)
  }
  finally {
    loading.value = false
  }
}

async function createClass(): Promise<void> {
  const name = className.value.trim()

  if (!name) {
    useToastWarning('请输入班级名称')
    return
  }

  creating.value = true

  try {
    const response = await $fetch<{ data: ShowcaseClass, used: ShowcaseUsed }>(CLASSES_URL, {
      method: 'POST',
      body: { name }
    })

    className.value = ''
    await refreshState()

    lastResult.value = {
      label: '新建班级',
      ok: true,
      status: 200,
      message: `已创建「${response.data.name}」，当前已用 ${response.used.classCount}`,
      hint: '配额校验通过：服务端先断言、后写入，返回里带着最新已用量'
    }

    useToastSuccess('创建成功', 3000, `已用 ${response.used.classCount}`)
  }
  catch (error) {
    recordFailure('class', '新建班级', error)
    useToastError('创建失败', 5000, readApiError(error).message)
  }
  finally {
    creating.value = false
  }
}

async function removeClass(item: ShowcaseClass): Promise<void> {
  removingId.value = item.id

  try {
    const response = await $fetch<{ data: { id: string, removed: boolean }, used: ShowcaseUsed }>(`${CLASSES_URL}/delete`, {
      method: 'POST',
      body: { id: item.id }
    })

    await refreshState()

    lastResult.value = {
      label: '删除班级',
      ok: response.data.removed,
      status: 200,
      message: response.data.removed
        ? `已删除「${item.name}」，当前已用 ${response.used.classCount}`
        : '没有删除任何数据（id 不存在或不属于当前用户）',
      hint: '删除会释放配额：删掉一条后可以再建一条，用来说明「已用量」是服务端实时算的'
    }

    if (response.data.removed) {
      useToastSuccess('删除成功', 3000, `已用 ${response.used.classCount}`)
    }
    else {
      useToastWarning('未删除任何数据')
    }
  }
  catch (error) {
    recordFailure('remove', '删除班级', error)
    useToastError('删除失败', 5000, readApiError(error).message)
  }
  finally {
    removingId.value = null
  }
}

async function createHidden(): Promise<void> {
  hiddenCreating.value = true

  try {
    const response = await $fetch<{ data: { id: string }, used: ShowcaseUsed }>(HIDDEN_URL, { method: 'POST' })

    await refreshState()

    lastResult.value = {
      label: '隐藏配额创建',
      ok: true,
      status: 200,
      message: `创建成功（id：${response.data.id}）`,
      hint: '页面不展示这一项的名称与额度：第一次成功，再点一次才会看到通用文案的拒绝'
    }

    useToastSuccess('创建成功', 3000, '这一项没有可见额度，再点一次试试')
  }
  catch (error) {
    recordFailure('hidden', '隐藏配额创建', error)
    // 隐藏项的拒绝文案由守卫决定，前端原样展示，不额外补充上限信息
    useToastError('创建失败', 5000, readApiError(error).message)
  }
  finally {
    hiddenCreating.value = false
  }
}

async function exportReport(): Promise<void> {
  exporting.value = true

  try {
    const response = await $fetch<{ ok: boolean, rows: unknown[] }>(EXPORT_URL)

    lastResult.value = {
      label: '导出报表',
      ok: response.ok,
      status: 200,
      message: `导出成功，共 ${response.rows.length} 行`,
      hint: '开关型能力：开关关闭时 v-feature 直接把按钮移除，所以能点到这里说明开关是开的'
    }

    useToastSuccess('导出成功', 3000, `共 ${response.rows.length} 行`)
  }
  catch (error) {
    recordFailure('export', '导出报表', error)
    useToastError('导出失败', 5000, readApiError(error).message)
  }
  finally {
    exporting.value = false
  }
}

onMounted(refreshState)
</script>

<template>
  <div class="h-full flex flex-col gap-3 overflow-auto p-3">
    <!-- 说明卡 -->
    <UCard>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge color="primary" variant="subtle" size="sm">
              能力与配额
            </UBadge>
            <span class="text-xs text-(--ui-text-muted)">
              当前等级：{{ levelName ?? '未匹配会员等级（能力取目录默认值）' }}
            </span>
          </div>
          <p class="mt-2 text-sm leading-6 text-(--ui-text-highlighted)">
            能力与配额由会员等级决定：服务端强制（assertEntitlement），前端只做体验（v-feature / useEntitlement）。
          </p>
          <p class="mt-1 text-xs leading-5 text-(--ui-text-muted)">
            把按钮改成可点、或直接调接口，都会被服务端拦住；隐藏项连「上限是多少」都不会告诉前端。
          </p>
        </div>
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="outline"
          :loading="loading"
          @click="refreshState"
        >
          刷新
        </UButton>
      </div>
    </UCard>

    <!-- 当前能力面板 -->
    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-sm font-medium text-(--ui-text-highlighted)">当前能力</span>
          <span class="text-xs text-(--ui-text-muted)">
            数据来自接口 state.visible，隐藏项已被服务端过滤
          </span>
        </div>
      </template>

      <div v-if="loading" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <USkeleton v-for="i in 3" :key="i" class="h-20 w-full rounded-md" />
      </div>

      <div v-else-if="visibleItems.length === 0" class="rounded-md border border-dashed border-(--ui-border) p-6 text-center text-sm text-(--ui-text-muted)">
        当前没有可见能力项：能力目录可能为空，或者全部被配置为 user_show = 0（服务端仍然会拦截）。
      </div>

      <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="item in visibleItems"
          :key="item.key"
          class="rounded-md border border-(--ui-border) p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="truncate text-sm font-medium text-(--ui-text-highlighted)">
              {{ item.name }}
            </span>
            <UBadge :color="item.kind === 'switch' ? 'info' : 'primary'" size="xs" variant="subtle">
              {{ item.kind === 'switch' ? '开关' : '配额' }}
            </UBadge>
          </div>
          <div class="mt-1 truncate font-mono text-xs text-(--ui-text-dimmed)">
            {{ item.key }}
          </div>
          <div class="mt-2 flex items-center gap-2">
            <UBadge
              v-if="item.kind === 'switch'"
              :color="can(item.key) ? 'success' : 'neutral'"
              size="sm"
              variant="subtle"
            >
              {{ itemValueText(item) }}
            </UBadge>
            <span v-else class="text-sm text-(--ui-text-highlighted)">{{ itemValueText(item) }}</span>
          </div>
        </div>
      </div>
    </UCard>

    <!-- 班级演示（配额） -->
    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-medium text-(--ui-text-highlighted)">班级演示（配额 demo.class.max）</span>
            <UBadge :color="classExhausted ? 'error' : 'neutral'" variant="subtle" size="sm">
              {{ classUsageText }}
            </UBadge>
          </div>
          <span class="text-xs text-(--ui-text-muted)">
            v-feature:disable → 配额用尽时置灰而不是消失；导出开关当前：{{ profile ? (reportExportOn ? '开' : '关') : '加载中…' }}
          </span>
        </div>
      </template>

      <div class="flex flex-wrap items-center gap-2">
        <UInput
          v-model="className"
          placeholder="输入班级名称（最多 40 字）"
          :maxlength="40"
          class="w-full sm:w-64"
          @keyup.enter="createClass"
        />
        <UButton
          v-feature:disable="'demo.class.max'"
          icon="i-lucide-plus"
          :loading="creating"
          :disabled="classExhausted"
          @click="createClass"
        >
          新建班级
        </UButton>

        <!-- 开关型：关闭时整颗按钮不渲染（v-feature 不是 disable） -->
        <UButton
          v-feature="'demo.report.export'"
          icon="i-lucide-download"
          color="neutral"
          variant="outline"
          :loading="exporting"
          @click="exportReport"
        >
          导出报表
        </UButton>

        <!-- 隐藏项：故意不加 v-feature，页面上没有任何额度提示，全靠服务端拦 -->
        <UButton
          icon="i-lucide-eye-off"
          color="neutral"
          variant="outline"
          :loading="hiddenCreating"
          @click="createHidden"
        >
          隐藏配额创建
        </UButton>
        <span class="text-xs text-(--ui-text-muted)">
          （这一项你在页面上看不到额度，但服务端依然会拦）
        </span>
      </div>

      <p v-if="classExhausted" class="mt-2 text-xs text-(--ui-error)">
        班级配额已用尽：按钮已置灰。服务端仍会重新计算「已用 + 1」并拒绝，绕过前端也建不出来。
      </p>

      <div class="mt-3">
        <div v-if="loading" class="space-y-2">
          <USkeleton v-for="i in 3" :key="i" class="h-10 w-full rounded-md" />
        </div>

        <div
          v-else-if="(state?.classes.length ?? 0) === 0"
          class="rounded-md border border-dashed border-(--ui-border) p-6 text-center text-sm text-(--ui-text-muted)"
        >
          还没有班级。点「新建班级」创建第一条 —— 已用量从 0 开始，用完上限按钮就会置灰。
        </div>

        <ul v-else class="divide-y divide-(--ui-border) rounded-md border border-(--ui-border)">
          <li
            v-for="item in state?.classes ?? []"
            :key="item.id"
            class="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
          >
            <div class="min-w-0">
              <div class="truncate text-sm font-medium text-(--ui-text-highlighted)">
                {{ item.name }}
              </div>
              <div class="text-xs text-(--ui-text-muted)">
                创建于 {{ formatDateTime(item.createdAt) }}
              </div>
            </div>
            <UButton
              size="xs"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              :loading="removingId === item.id"
              @click="removeClass(item)"
            >
              删除
            </UButton>
          </li>
        </ul>
      </div>
    </UCard>

    <!-- 最近一次请求：三种拦截效果的对照 -->
    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-sm font-medium text-(--ui-text-highlighted)">最近一次服务端响应</span>
          <span class="text-xs text-(--ui-text-muted)">
            配额用尽 / 开关关闭 / 隐藏拦截 都是 403，区别在入口与文案
          </span>
        </div>
      </template>

      <div v-if="!lastResult" class="text-sm text-(--ui-text-muted)">
        还没有发起请求。可以依次试：新建到上限（配额）→ 关闭 demo.report.export（开关）→ 连点两次隐藏配额创建（隐藏项）。
      </div>

      <div v-else class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <UBadge :color="lastResult.ok ? 'success' : 'error'" variant="subtle" size="sm">
            {{ lastResult.ok ? '成功' : '失败' }}
          </UBadge>
          <span class="text-sm font-medium text-(--ui-text-highlighted)">{{ lastResult.label }}</span>
          <span class="text-xs text-(--ui-text-muted)">HTTP {{ lastResult.status ?? '—' }}</span>
        </div>
        <p class="text-sm leading-6 text-(--ui-text-highlighted)">
          {{ lastResult.message }}
        </p>
        <p class="text-xs leading-5 text-(--ui-text-muted)">
          演示要点：{{ lastResult.hint }}
        </p>
      </div>

      <div class="mt-3 grid gap-2 text-xs leading-5 text-(--ui-text-muted) sm:grid-cols-3">
        <div class="rounded-md border border-(--ui-border) p-3">
          <div class="mb-1 flex items-center gap-1 font-medium text-(--ui-text-highlighted)">
            <UIcon name="i-lucide-gauge" class="size-3.5" />
            配额（可见上限）
          </div>
          新建班级到上限：按钮置灰，服务端提示「该功能上限 N」。
        </div>
        <div class="rounded-md border border-(--ui-border) p-3">
          <div class="mb-1 flex items-center gap-1 font-medium text-(--ui-text-highlighted)">
            <UIcon name="i-lucide-toggle-left" class="size-3.5" />
            开关（关闭）
          </div>
          导出按钮直接不渲染；直接调接口则 403 通用文案。
        </div>
        <div class="rounded-md border border-(--ui-border) p-3">
          <div class="mb-1 flex items-center gap-1 font-medium text-(--ui-text-highlighted)">
            <UIcon name="i-lucide-eye-off" class="size-3.5" />
            隐藏配额
          </div>
          页面看不到额度；第一次成功、第二次被通用文案拒绝。
        </div>
      </div>
    </UCard>
  </div>
</template>
