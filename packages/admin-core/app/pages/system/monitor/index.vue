<template>
  <div class="flex h-full flex-col gap-3 overflow-auto p-3">
    <UCard :ui="{ body: 'p-3 sm:p-4' }">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <h2 class="text-base font-semibold">{{ $ts('module.system.monitor.title') }}</h2>
          <UBadge v-if="data" color="neutral" variant="subtle" size="sm">
            {{ $ts('module.system.monitor.lastUpdated') }}: {{ formatTime(data.sampledAt) }}
          </UBadge>
        </div>

        <div class="flex items-center gap-2">
          <USwitch v-model="autoRefresh" :label="$ts('module.system.monitor.autoRefresh')" />
          <UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" :loading="loading" @click="load">
            {{ $ts('common.refresh') }}
          </UButton>
        </div>
      </div>

      <div class="mt-3 flex w-fit rounded-md border border-gray-200 p-1 dark:border-gray-700">
        <UButton
            v-for="tab in tabs"
            :key="tab.value"
            size="sm"
            :variant="active === tab.value ? 'solid' : 'ghost'"
            :color="active === tab.value ? 'primary' : 'neutral'"
            @click="active = tab.value"
        >
          {{ $ts(tab.label) }}
        </UButton>
      </div>
    </UCard>

    <div v-if="!data" class="flex flex-1 items-center justify-center text-sm text-muted">
      {{ loading ? $ts('common.loading') : $ts('common.noData') }}
    </div>

    <!-- 服务监控 -->
    <template v-else-if="active === 'service'">
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <UCard :ui="{ body: 'p-4' }">
          <div class="mb-2 flex items-center justify-between">
            <span class="font-medium">{{ $ts('module.system.monitor.service.cpu') }}</span>
            <span class="text-sm font-semibold">{{ formatPercent(data.server.cpu.usage) }}</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${clamp(data.server.cpu.usage)}%` }" />
          </div>
          <dl class="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
            <div>{{ $ts('module.system.monitor.service.cores') }}: {{ data.server.cpu.cores }}</div>
            <div>{{ $ts('module.system.monitor.service.load') }}: {{ data.server.cpu.loadavg.map(v => v.toFixed(2)).join(' / ') }}</div>
            <div class="col-span-2 truncate">{{ $ts('module.system.monitor.service.model') }}: {{ data.server.cpu.model }}</div>
          </dl>
        </UCard>

        <UCard :ui="{ body: 'p-4' }">
          <div class="mb-2 flex items-center justify-between">
            <span class="font-medium">{{ $ts('module.system.monitor.service.memory') }}</span>
            <span class="text-sm font-semibold">{{ formatPercent(data.server.memory.usage) }}</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div class="h-full rounded-full bg-amber-500 transition-all" :style="{ width: `${clamp(data.server.memory.usage)}%` }" />
          </div>
          <dl class="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
            <div>{{ formatBytes(data.server.memory.used) }} / {{ formatBytes(data.server.memory.total) }}</div>
            <div>{{ $ts('module.system.monitor.service.free') }}: {{ formatBytes(data.server.memory.free) }}</div>
          </dl>
        </UCard>

        <UCard :ui="{ body: 'p-4' }">
          <div class="mb-2 flex items-center justify-between">
            <span class="font-medium">{{ $ts('module.system.monitor.service.disk') }}</span>
            <span v-if="data.server.disk" class="text-sm font-semibold">{{ formatPercent(data.server.disk.usage) }}</span>
          </div>
          <template v-if="data.server.disk">
            <div class="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div class="h-full rounded-full bg-emerald-500 transition-all" :style="{ width: `${clamp(data.server.disk.usage)}%` }" />
            </div>
            <dl class="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
              <div>{{ formatBytes(data.server.disk.used) }} / {{ formatBytes(data.server.disk.total) }}</div>
              <div>{{ $ts('module.system.monitor.service.free') }}: {{ formatBytes(data.server.disk.free) }}</div>
            </dl>
          </template>
          <p v-else class="mt-3 text-xs text-muted">{{ $ts('module.system.monitor.service.diskUnavailable') }}</p>
        </UCard>

        <UCard :ui="{ body: 'p-4' }">
          <div class="mb-2 font-medium">{{ $ts('module.system.monitor.service.runtime') }}</div>
          <dl class="grid grid-cols-2 gap-2 text-xs text-muted">
            <div>{{ $ts('module.system.monitor.service.hostname') }}: {{ data.server.hostname }}</div>
            <div>{{ $ts('module.system.monitor.service.platform') }}: {{ data.server.platform }} / {{ data.server.arch }}</div>
            <div>Node: {{ data.server.process.node }}</div>
            <div>PID: {{ data.server.process.pid }}</div>
            <div>{{ $ts('module.system.monitor.service.uptime') }}: {{ formatDuration(data.server.process.uptime) }}</div>
            <div>{{ $ts('module.system.monitor.service.systemUptime') }}: {{ formatDuration(data.server.uptime) }}</div>
            <div class="col-span-2">
              {{ $ts('module.system.monitor.service.processMemory') }}:
              RSS {{ formatBytes(data.server.processMemory.rss) }} /
              Heap {{ formatBytes(data.server.processMemory.heapUsed) }} / {{ formatBytes(data.server.processMemory.heapTotal) }}
            </div>
          </dl>
        </UCard>
      </div>
    </template>

    <!-- 缓存监控 -->
    <template v-else-if="active === 'cache'">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <UCard :ui="{ body: 'p-4' }">
          <div class="text-xs text-muted">{{ $ts('module.system.monitor.cache.keys') }}</div>
          <div class="mt-1 text-2xl font-semibold">{{ data.cache.keys }}</div>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <div class="text-xs text-muted">{{ $ts('module.system.monitor.cache.hitRate') }}</div>
          <div class="mt-1 text-2xl font-semibold">{{ formatPercent(data.cache.metrics.hitRate * 100) }}</div>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <div class="text-xs text-muted">{{ $ts('module.system.monitor.cache.avgGet') }}</div>
          <div class="mt-1 text-2xl font-semibold">{{ data.cache.metrics.avgGetMs.toFixed(2) }} ms</div>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <div class="text-xs text-muted">{{ $ts('module.system.monitor.cache.bytesWritten') }}</div>
          <div class="mt-1 text-2xl font-semibold">{{ formatBytes(data.cache.metrics.bytesWritten) }}</div>
        </UCard>
      </div>

      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <UCard :ui="{ body: 'p-4' }">
          <div class="mb-3 font-medium">{{ $ts('module.system.monitor.cache.metrics') }}</div>
          <dl class="grid grid-cols-2 gap-2 text-sm">
            <div class="flex justify-between"><span class="text-muted">{{ $ts('module.system.monitor.cache.hits') }}</span><span>{{ data.cache.metrics.hits }}</span></div>
            <div class="flex justify-between"><span class="text-muted">{{ $ts('module.system.monitor.cache.misses') }}</span><span>{{ data.cache.metrics.misses }}</span></div>
            <div class="flex justify-between"><span class="text-muted">{{ $ts('module.system.monitor.cache.sets') }}</span><span>{{ data.cache.metrics.sets }}</span></div>
            <div class="flex justify-between"><span class="text-muted">{{ $ts('module.system.monitor.cache.deletes') }}</span><span>{{ data.cache.metrics.deletes }}</span></div>
            <div class="flex justify-between"><span class="text-muted">{{ $ts('module.system.monitor.cache.errors') }}</span><span>{{ data.cache.metrics.errors }}</span></div>
            <div class="flex justify-between"><span class="text-muted">{{ $ts('module.system.monitor.cache.avgSet') }}</span><span>{{ data.cache.metrics.avgSetMs.toFixed(2) }} ms</span></div>
          </dl>
        </UCard>

        <UCard :ui="{ body: 'p-4' }">
          <div class="mb-3 font-medium">{{ $ts('module.system.monitor.cache.prefixes') }}</div>
          <table class="w-full text-left text-xs">
            <thead class="text-muted">
              <tr>
                <th class="pb-2">{{ $ts('module.system.monitor.cache.prefix') }}</th>
                <th class="pb-2 text-right">{{ $ts('module.system.monitor.cache.count') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in data.cache.prefixes" :key="item.prefix" class="border-t border-gray-100 dark:border-gray-800">
                <td class="py-1.5 font-mono">{{ item.prefix }}</td>
                <td class="py-1.5 text-right">{{ item.count }}</td>
              </tr>
              <tr v-if="data.cache.prefixes.length === 0">
                <td colspan="2" class="py-4 text-center text-muted">{{ $ts('common.noData') }}</td>
              </tr>
            </tbody>
          </table>
        </UCard>
      </div>

      <UAlert color="info" variant="subtle" icon="i-lucide-info" :title="$ts('module.system.monitor.cache.note')" />
    </template>

    <!-- 连接池 -->
    <template v-else>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <UCard :ui="{ body: 'p-4' }">
          <div class="text-xs text-muted">{{ $ts('module.system.monitor.pool.total') }}</div>
          <div class="mt-1 text-2xl font-semibold">{{ data.pool.total }} / {{ data.pool.connectionLimit }}</div>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <div class="text-xs text-muted">{{ $ts('module.system.monitor.pool.active') }}</div>
          <div class="mt-1 text-2xl font-semibold">{{ data.pool.active }}</div>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <div class="text-xs text-muted">{{ $ts('module.system.monitor.pool.idle') }}</div>
          <div class="mt-1 text-2xl font-semibold">{{ data.pool.idle }}</div>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <div class="text-xs text-muted">{{ $ts('module.system.monitor.pool.waiting') }}</div>
          <div class="mt-1 text-2xl font-semibold">{{ data.pool.waiting }}</div>
        </UCard>
      </div>

      <UCard :ui="{ body: 'p-4' }">
        <div class="mb-3 font-medium">{{ $ts('module.system.monitor.pool.counters') }}</div>
        <dl class="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div class="flex justify-between"><span class="text-muted">{{ $ts('module.system.monitor.pool.created') }}</span><span>{{ data.pool.created }}</span></div>
          <div class="flex justify-between"><span class="text-muted">{{ $ts('module.system.monitor.pool.acquired') }}</span><span>{{ data.pool.acquired }}</span></div>
          <div class="flex justify-between"><span class="text-muted">{{ $ts('module.system.monitor.pool.released') }}</span><span>{{ data.pool.released }}</span></div>
          <div class="flex justify-between"><span class="text-muted">{{ $ts('module.system.monitor.pool.enqueued') }}</span><span>{{ data.pool.enqueued }}</span></div>
        </dl>
        <p v-if="!data.pool.initialized" class="mt-3 text-xs text-muted">
          {{ $ts('module.system.monitor.pool.notInitialized') }}
        </p>
      </UCard>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { MonitorOverview } from '#admin/shared/system/monitor'

definePageMeta({
  layout: 'system',
  title: '系统监控',
  icon: 'i-lucide-activity',
})

const { $trpc } = useNuxtApp()
const { $ts } = useI18n()

const active = ref<'service' | 'cache' | 'pool'>('service')
const autoRefresh = ref(true)
const loading = ref(false)
const data = ref<MonitorOverview | null>(null)

const tabs = [
  { value: 'service' as const, label: 'module.system.monitor.tabs.service' },
  { value: 'cache' as const, label: 'module.system.monitor.tabs.cache' },
  { value: 'pool' as const, label: 'module.system.monitor.tabs.pool' },
]

const clamp = (value: number) => Math.min(100, Math.max(0, value))
const formatPercent = (value: number) => `${value.toFixed(1)}%`

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let index = 0
  let size = value
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m ${total % 60}s`
}

function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString()
}

async function load() {
  if (loading.value) return
  loading.value = true
  try {
    data.value = await $trpc.sysMonitor.overview.query()
  }
  finally {
    loading.value = false
  }
}

let timer: ReturnType<typeof setInterval> | undefined

onMounted(async () => {
  await load()
  timer = setInterval(() => {
    if (autoRefresh.value) {
      void load()
    }
  }, 5000)
})

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>
