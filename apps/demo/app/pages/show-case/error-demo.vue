<script setup lang="ts">
definePageMeta({
  layout: 'system',
  title: '错误演示',
  icon: 'i-lucide-bug'
})

const { $trpc } = useNuxtApp()

type DemoKind = 'ok' | 'validation' | 'database' | 'business'

type DemoCase = {
  kind: DemoKind
  title: string
  desc: string
  branch: string
  color: 'success' | 'warning' | 'error'
  call: () => Promise<unknown>
}

const loading = ref<DemoKind | null>(null)
const lastKind = ref<DemoKind | null>(null)
const successData = ref<unknown>(null)
const errorData = ref<Record<string, unknown> | null>(null)

/** 触发一次调用，把成功数据或 errorFormatter 返回的 data 记下来 */
async function run(kind: DemoKind, call: () => Promise<unknown>) {
  loading.value = kind
  successData.value = null
  errorData.value = null

  try {
    successData.value = await call()
  }
  catch (error) {
    // tRPC 客户端会把 errorFormatter 的 data 挂在 error.data 上
    const err = error as { message?: string, data?: Record<string, unknown> }
    errorData.value = {
      ...(err.data ?? {}),
      message: err.data?.message ?? err.message
    }
  }
  finally {
    lastKind.value = kind
    loading.value = null
  }
}

const cases: DemoCase[] = [
  {
    kind: 'ok',
    title: '正常请求（对照）',
    desc: '入参合法、数据库可用，用来确认链路本身是通的。',
    branch: '不经过任何错误分支',
    color: 'success',
    call: () => $trpc.showCase.ok.query()
  },
  {
    kind: 'validation',
    title: '入参错误',
    desc: '故意传 count = 0、keyword = "a"：zod 校验失败，tRPC 在进入 resolver 之前就抛出 ZodError。',
    branch: 'errorFormatter → Zod 校验错误（汇总 issues 去重后拼接）',
    color: 'warning',
    call: () => $trpc.showCase.validationError.query({ count: 0, keyword: 'a' })
  },
  {
    kind: 'database',
    title: '数据库错误',
    desc: '查询一张不存在的表（不需要建表）：MySQL 返回 1146。前端只会拿到「数据库错误」这个分类文案，驱动原文与 SQL 不会外泄。',
    branch: 'errorFormatter → 数据库错误（详情只写日志，用 requestId 到 .data/evlogs 检索）',
    color: 'error',
    call: () => $trpc.showCase.databaseError.query()
  },
  {
    kind: 'business',
    title: '业务错误',
    desc: '抛 AppError(\'common.notExist\')：按 APP_ERROR_STATUS_MAP 映射为 404 / NOT_FOUND。',
    branch: 'errorFormatter → AppError（翻译 i18nKey）',
    color: 'error',
    call: () => $trpc.showCase.businessError.query()
  }
]

/** 把 errorFormatter 的字段整理成可展示的字符串 */
const errorFields = computed(() => {
  const data = errorData.value ?? {}
  const text = (value: unknown) => (value === undefined || value === null || value === '' ? '—' : String(value))

  return [
    { key: 'type', label: 'type（Toast 标题 / 错误分类）', value: text(data.type) },
    { key: 'message', label: 'message（已按请求语言翻译）', value: text(data.message) },
    { key: 'i18nKey', label: 'i18nKey（AppError 原始 key）', value: text(data.i18nKey) },
    { key: 'code', label: 'code（tRPC 错误码）', value: text(data.code) },
    { key: 'httpStatus', label: 'httpStatus', value: text(data.httpStatus) },
    { key: 'requestId', label: 'requestId（evlog 宽事件 id）', value: text(data.requestId) },
    { key: 'timestamp', label: 'timestamp', value: text(data.timestamp) }
  ]
})

const stackText = computed(() => {
  const stack = errorData.value?.stack
  return typeof stack === 'string' ? stack : ''
})
</script>

<template>
  <div class="h-full flex flex-col gap-3 overflow-auto p-3">
    <div class="grid gap-3 lg:grid-cols-2">
      <UCard v-for="item in cases" :key="item.kind">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <UBadge :color="item.color" variant="subtle" size="sm">
              {{ item.title }}
            </UBadge>
            <p class="mt-2 text-sm leading-6 text-(--ui-text-muted)">
              {{ item.desc }}
            </p>
            <p class="mt-1 text-xs text-(--ui-text-dimmed)">
              {{ item.branch }}
            </p>
          </div>
          <UButton
            color="primary"
            variant="outline"
            :loading="loading === item.kind"
            :disabled="loading !== null && loading !== item.kind"
            @click="run(item.kind, item.call)"
          >
            触发
          </UButton>
        </div>
      </UCard>
    </div>

    <UCard v-if="lastKind">
      <template #header>
        <div class="flex flex-wrap items-center gap-2">
          <UBadge :color="errorData ? 'error' : 'success'" variant="subtle">
            {{ errorData ? '失败' : '成功' }}
          </UBadge>
          <span class="text-sm font-medium text-(--ui-text-highlighted)">响应结果</span>
          <span class="text-xs text-(--ui-text-muted)">同一次请求也会由全局 link 弹一条 Toast</span>
        </div>
      </template>

      <div v-if="errorData" class="space-y-4">
        <dl class="grid gap-3 sm:grid-cols-2">
          <div v-for="field in errorFields" :key="field.key">
            <dt class="text-xs text-(--ui-text-muted)">
              {{ field.label }}
            </dt>
            <dd class="mt-1 break-all text-sm text-(--ui-text-highlighted)">
              {{ field.value }}
            </dd>
          </div>
        </dl>

        <div v-if="stackText">
          <div class="mb-1 text-xs text-(--ui-text-muted)">
            stack（需设置 NUXT_TRPC_ERROR_STACK=true 才返回）
          </div>
          <pre class="max-h-60 overflow-auto rounded-md border border-(--ui-border) bg-(--ui-bg-elevated) p-3 text-xs">{{ stackText }}</pre>
        </div>
      </div>

      <pre
        v-else
        class="overflow-auto rounded-md border border-(--ui-border) bg-(--ui-bg-elevated) p-3 text-xs"
      >{{ JSON.stringify(successData, null, 2) }}</pre>
    </UCard>
  </div>
</template>
