import os from 'node:os'
import { statfs } from 'node:fs/promises'
import type { MonitorDisk, MonitorServer } from '#admin/shared/system/monitor'

/**
 * 服务监控采集。
 *
 * CPU 使用率通过两次 os.cpus() 时间片差分计算；首次请求等待 200ms。
 * 不读取环境变量、数据库密码、Session 密钥等敏感信息。
 */

type CpuSnapshot = {
    idle: number
    total: number
}

let previousCpu: CpuSnapshot | null = null

function cpuSnapshot(): CpuSnapshot {
    return os.cpus().reduce<CpuSnapshot>((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0)
        return {
            idle: acc.idle + cpu.times.idle,
            total: acc.total + total,
        }
    }, { idle: 0, total: 0 })
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function cpuUsage() {
    let current = cpuSnapshot()

    if (!previousCpu) {
        await sleep(200)
        previousCpu = current
        current = cpuSnapshot()
    }

    const idleDelta = current.idle - previousCpu.idle
    const totalDelta = current.total - previousCpu.total
    previousCpu = current

    if (totalDelta <= 0) {
        return 0
    }

    return Math.min(100, Math.max(0, (1 - idleDelta / totalDelta) * 100))
}

async function diskInfo(): Promise<MonitorDisk> {
    try {
        const stats = await statfs(process.cwd())
        const total = stats.bsize * stats.blocks
        const free = stats.bsize * stats.bavail
        const used = Math.max(0, total - free)

        return {
            path: '.',
            total,
            free,
            used,
            usage: total > 0 ? (used / total) * 100 : 0,
        }
    }
    catch {
        return null
    }
}

function processVersions() {
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(process.versions)) {
        if (typeof value === 'string') {
            result[key] = value
        }
    }
    return result
}

export async function collectServerMonitor(): Promise<MonitorServer> {
    const [usage, disk] = await Promise.all([cpuUsage(), diskInfo()])
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()
    const usedMemory = Math.max(0, totalMemory - freeMemory)
    const memory = process.memoryUsage()
    const cpus = os.cpus()

    return {
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        uptime: os.uptime(),
        cpu: {
            usage,
            cores: cpus.length,
            model: cpus[0]?.model?.trim() || 'unknown',
            loadavg: os.loadavg(),
        },
        memory: {
            total: totalMemory,
            free: freeMemory,
            used: usedMemory,
            usage: totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0,
        },
        processMemory: {
            rss: memory.rss,
            heapTotal: memory.heapTotal,
            heapUsed: memory.heapUsed,
            external: memory.external,
            arrayBuffers: memory.arrayBuffers,
        },
        disk,
        process: {
            pid: process.pid,
            uptime: process.uptime(),
            node: process.version,
            versions: processVersions(),
        },
        sampledAt: new Date().toISOString(),
    }
}
