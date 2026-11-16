#!/usr/bin/env node
/**
 * 代码生成 V2 的 AI/CLI 客户端。
 *
 * 它只负责从后台取生成结果，不写业务代码、不合并文件；
 * 合并由外部 AI 按 plan 里的 mergePlan 完成。
 *
 * 用法：
 *   pnpm gen:ai:tables
 *   pnpm gen:ai:guide
 *   pnpm gen:ai:plan --table=sys_demo [--module=system/demo] [--business=SysDemo]
 *   pnpm gen:ai:download --table=sys_demo [--out=.data/codegen]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const BASE_URL = (process.env.CODEGEN_BASE_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '')
const TOKEN = process.env.CODEGEN_TOKEN || process.env.NUXT_CODEGEN_TOKEN || ''
const OUT_DIR = process.env.CODEGEN_OUT_DIR || join(ROOT, '.data', 'codegen')

function fail(message) {
    console.error(`[codegen-ai] ${message}`)
    process.exit(1)
}

function getOption(name) {
    const args = process.argv.slice(3)
    const prefix = `--${name}=`
    const hit = args.find(item => item.startsWith(prefix))
    if (hit) {
        return hit.slice(prefix.length)
    }

    const index = args.indexOf(`--${name}`)
    if (index >= 0) {
        return args[index + 1]
    }

    return undefined
}

function authHeaders(extra = {}) {
    const headers = { ...extra }
    if (TOKEN) {
        headers.Authorization = `Bearer ${TOKEN}`
    }
    return headers
}

async function request(path, init = {}) {
    const response = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: authHeaders(init.headers),
    })

    if (!response.ok) {
        const text = await response.text()
        fail(`HTTP ${response.status} ${path}\n${text}`)
    }

    return response
}

function ensureOutDir() {
    mkdirSync(OUT_DIR, { recursive: true })
}

function printJson(value) {
    console.log(JSON.stringify(value, null, 2))
}

async function commandTables() {
    const response = await request('/api/system/gen/ai/tables')
    printJson(await response.json())
}

async function commandGuide() {
    const response = await request('/api/system/gen/ai/guide')
    ensureOutDir()
    const path = join(OUT_DIR, 'guide.md')
    writeFileSync(path, await response.text())
    console.log(`guide written: ${path}`)
}

async function commandPlan() {
    const table = getOption('table')
    if (!table) {
        fail('missing --table=<tableName>')
    }

    const body = {
        tableName: table,
        moduleName: getOption('module'),
        businessName: getOption('business'),
    }

    const response = await request('/api/system/gen/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })

    const plan = await response.json()
    ensureOutDir()
    const path = join(OUT_DIR, `${table}-plan.json`)
    writeFileSync(path, JSON.stringify(plan, null, 2))

    console.log(`plan written: ${path}`)
    console.log(`table: ${plan.table.tableName}`)
    console.log(`files: ${plan.files.length}`)
    console.log('merge targets:')
    console.log(`  ${plan.mergePlan.schemaIndex.path}`)
    console.log(`  ${plan.mergePlan.routers.path}`)
    console.log(`  ${plan.mergePlan.locales.zhPath}`)
    console.log(`  ${plan.mergePlan.locales.enPath}`)
    console.log(`download: POST ${BASE_URL}${plan.download.path}`)
}

async function commandDownload() {
    const table = getOption('table')
    if (!table) {
        fail('missing --table=<tableName>')
    }

    const response = await request('/api/system/gen/ai/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName: table }),
    })

    const outDir = getOption('out') || OUT_DIR
    mkdirSync(outDir, { recursive: true })
    const path = join(outDir, `${table}-codegen.zip`)
    const buffer = Buffer.from(await response.arrayBuffer())
    writeFileSync(path, buffer)
    console.log(`zip written: ${path}`)
}

function usage() {
    console.log(`代码生成 V2 CLI

用法：
  pnpm gen:ai:tables
  pnpm gen:ai:guide
  pnpm gen:ai:plan --table=<tableName> [--module=<module>] [--business=<Business>]
  pnpm gen:ai:download --table=<tableName> [--out=<dir>]

环境变量：
  CODEGEN_BASE_URL   默认 http://127.0.0.1:3001
  CODEGEN_TOKEN      与后台 NUXT_CODEGEN_TOKEN 相同
  CODEGEN_OUT_DIR    默认 <repo>/.data/codegen
`)
}

const command = process.argv[2]

try {
    switch (command) {
        case 'tables':
            await commandTables()
            break
        case 'guide':
            await commandGuide()
            break
        case 'plan':
            await commandPlan()
            break
        case 'download':
            await commandDownload()
            break
        default:
            usage()
            if (command && command !== 'help') {
                process.exitCode = 1
            }
    }
}
catch (error) {
    fail(error instanceof Error ? error.message : String(error))
}
