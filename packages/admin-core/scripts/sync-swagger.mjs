#!/usr/bin/env node
/**
 * 把 Swagger UI 的两个静态文件同步到本层的 public/ 目录。
 *
 * 为什么需要这个脚本（而不是让 Nuxt 直接读 node_modules）：
 * - dev 模式下 `nitro.serverAssets` 不会全量挂载 node_modules（实测只挂载被 rollup 引用过的条目）；
 * - `nitro.publicAssets` 在 dev 由 Vite 接管，同样读不到。
 * 复制到 public/ 后，dev 由 Vite 提供、构建时随 public 进入 .output/public，
 * 两种环境行为一致，也不依赖生产镜像里的 node_modules（Dockerfile 只 COPY .output）。
 *
 * 两个调用方：
 * 1. `nuxt.config.ts` 的 `build:before` 钩子（dev / build 前）；
 * 2. `package.json` 的 `prepack`（npm 发布前）。
 *
 * 第 2 点是发布必需的一步：`public/swagger-ui` 在 .gitignore 里，CI 全新 clone
 * 时并不存在，如果不在这时生成，发出去的包里就没有这两个文件，
 * 业务项目访问 /api/docs 会白屏。
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SWAGGER_FILES = ['swagger-ui-bundle.js', 'swagger-ui.css']

/**
 * @param {string} [packageDir] 包根目录，默认取本脚本所在目录的上一级
 * @returns {string[]} 实际同步成功的文件名
 */
export function syncSwaggerUiAssets(packageDir) {
    const root = packageDir ?? resolve(dirname(fileURLToPath(import.meta.url)), '..')
    const targetDir = resolve(root, 'public/swagger-ui')

    mkdirSync(targetDir, { recursive: true })

    const synced = []

    for (const file of SWAGGER_FILES) {
        // 候选位置：
        // 1. 本包自己的 node_modules（仓库内开发时）
        // 2. 上两级 node_modules（包被安装到业务项目后，依赖可能被提升）
        const candidates = [
            resolve(root, 'node_modules/swagger-ui-dist', file),
            resolve(root, '../../node_modules/swagger-ui-dist', file)
        ]

        const source = candidates.find(candidate => existsSync(candidate))

        // 找不到时静默跳过：业务项目可能没有安装 swagger-ui-dist，
        // 此时使用包里已经发布好的那份（如果有）。
        if (source) {
            copyFileSync(source, resolve(targetDir, file))
            synced.push(file)
        }
    }

    return synced
}

// 作为 CLI 直接运行时（prepack / 手动执行）打印结果
if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
    const synced = syncSwaggerUiAssets()

    if (synced.length === 0) {
        console.warn('[sync-swagger] 未找到 swagger-ui-dist，跳过（沿用已有的 public/swagger-ui）')
    }
    else {
        console.log(`[sync-swagger] 已同步 ${synced.join(', ')}`)
    }
}
