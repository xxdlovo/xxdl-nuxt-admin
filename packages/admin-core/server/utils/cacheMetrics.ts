import type { MonitorCacheMetrics } from '#admin/shared/system/monitor'

/**
 * 进程内缓存指标。
 *
 * 当前项目使用 Nitro memory 作为缓存，没有 Redis；
 * 这里只统计 SysStorageService 的缓存读写，重启后清零。
 */
type CacheCounters = {
    hits: number
    misses: number
    sets: number
    deletes: number
    errors: number
    getLatencyMs: number
    getCount: number
    setLatencyMs: number
    setCount: number
    bytesWritten: number
}

const counters: CacheCounters = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    getLatencyMs: 0,
    getCount: 0,
    setLatencyMs: 0,
    setCount: 0,
    bytesWritten: 0,
}

export function recordCacheGet(hit: boolean, durationMs: number) {
    if (hit) {
        counters.hits += 1
    }
    else {
        counters.misses += 1
    }
    counters.getLatencyMs += Math.max(0, durationMs)
    counters.getCount += 1
}

export function recordCacheSet(bytes: number, durationMs: number) {
    counters.sets += 1
    counters.bytesWritten += Math.max(0, bytes)
    counters.setLatencyMs += Math.max(0, durationMs)
    counters.setCount += 1
}

export function recordCacheDelete(count = 1) {
    counters.deletes += Math.max(0, count)
}

export function recordCacheError() {
    counters.errors += 1
}

export function getCacheMetrics(): MonitorCacheMetrics {
    const totalGets = counters.hits + counters.misses
    return {
        hits: counters.hits,
        misses: counters.misses,
        sets: counters.sets,
        deletes: counters.deletes,
        errors: counters.errors,
        hitRate: totalGets > 0 ? counters.hits / totalGets : 0,
        avgGetMs: counters.getCount > 0 ? counters.getLatencyMs / counters.getCount : 0,
        avgSetMs: counters.setCount > 0 ? counters.setLatencyMs / counters.setCount : 0,
        bytesWritten: counters.bytesWritten,
    }
}
