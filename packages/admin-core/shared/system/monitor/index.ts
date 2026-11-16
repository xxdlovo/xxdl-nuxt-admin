export type MonitorCpu = {
    usage: number
    cores: number
    model: string
    loadavg: number[]
}

export type MonitorMemory = {
    total: number
    free: number
    used: number
    usage: number
}

export type MonitorProcessMemory = {
    rss: number
    heapTotal: number
    heapUsed: number
    external: number
    arrayBuffers: number
}

export type MonitorDisk = {
    path: string
    total: number
    free: number
    used: number
    usage: number
} | null

export type MonitorServer = {
    hostname: string
    platform: string
    release: string
    arch: string
    uptime: number
    cpu: MonitorCpu
    memory: MonitorMemory
    processMemory: MonitorProcessMemory
    disk: MonitorDisk
    process: {
        pid: number
        uptime: number
        node: string
        versions: Record<string, string>
    }
    sampledAt: string
}

export type MonitorCachePrefix = {
    prefix: string
    count: number
}

export type MonitorCacheMetrics = {
    hits: number
    misses: number
    sets: number
    deletes: number
    errors: number
    hitRate: number
    avgGetMs: number
    avgSetMs: number
    bytesWritten: number
}

export type MonitorCache = {
    keys: number
    prefixes: MonitorCachePrefix[]
    metrics: MonitorCacheMetrics
    note: string
}

export type MonitorPool = {
    initialized: boolean
    connectionLimit: number
    total: number
    active: number
    idle: number
    waiting: number
    created: number
    acquired: number
    released: number
    enqueued: number
}

export type MonitorOverview = {
    server: MonitorServer
    cache: MonitorCache
    pool: MonitorPool
    sampledAt: string
}
