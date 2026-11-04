#!/usr/bin/env node
/**
 * 分层契约检查（Layer Contract Check）
 *
 * 背景：项目由 `admin-core`（基座）→ `admin-trade`（可选业务层）→ `apps/demo`（宿主）
 * 三层组成。Nuxt Layer 的机制决定了「同名文件不等于覆盖」「多层 plugin 会全部注册」
 * 「每层依赖各自解析」—— 这些点一旦违反，表现为运行时 500 而不是编译错误，
 * 排查成本很高（本项目已经踩过 $trpc 重复注入、pinia 双实例、组件同名类型退化）。
 *
 * 这个脚本把这些隐性契约变成可执行的检查，跑一次即可覆盖下面 6 类问题：
 *
 *   1. 单例依赖扩散  —— 同一个必须单例的库被多个包各自声明，pnpm 会生成多份物理实例
 *   2. 宿主别名         —— 包内使用 `~/`、`@/`、`#server`、`#shared`（都指向宿主，不是本包）
 *   3. 解构 $ 前缀属性  —— `const { $ts } = useI18n()` 会让 $ts 变成 setup 变量并遮蔽全局属性
 *   4. 跨层注入冲突     —— 多层 plugin 对同一个 key 做 provide（Nuxt 注入属性不可重定义）
 *   5. 同文件重复声明   —— `<script setup>` 里同一个名字 const 两次，Vue 编译失败但报错容易被掩盖
 *   6. 跨层同名组件     —— 组件同名会让 Vue 模板类型推断整体退化
 *
 * 用法：
 *   pnpm check:layers            # 输出问题清单，有错误时退出码 1
 *   pnpm check:layers --json     # 机器可读
 *
 * 约定：只有 `packages/admin-core` 是单例库的提供者；`admin-trade` 与 `apps/demo`
 * 应以 peerDependencies 声明（不安装实体），由宿主统一提供同一份实例。
 */
import { readFileSync, readdirSync, readlinkSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const jsonOutput = process.argv.includes('--json')

/**
 * 运行时单例：多个包各装一份时会产生**互不相通的状态**，必须全局唯一。
 * 典型症状就是本项目踩过的 `getActivePinia() was called but there was no active Pinia`。
 */
const RUNTIME_SINGLETONS = [
    'pinia',
    'vue',
    'vue-router',
    '@trpc/client',
    '@trpc/server',
    'trpc-nuxt'
]

/**
 * 构建期框架：分叉不会共享可变状态（通过模块系统工作），只作为提示。
 * 仍然希望版本一致，但不阻断。
 */
const BUILD_FRAMEWORK_DEPS = [
    'nuxt',
    '@nuxt/ui'
]

/** 单例库的唯一提供者 */
const PROVIDER_PKG = 'packages/admin-core'

/**
 * 工作区里的所有 layer 目录（自动发现，新增 apps/* 或 packages/* 无需改脚本）。
 * 顺序即层级：越靠后越"上游"。
 */
function discoverLayers() {
    const layers = []

    for (const group of ['packages', 'apps']) {
        const dir = resolve(ROOT, group)
        if (!statSafe(dir)) continue

        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isDirectory() || entry.name.startsWith('.')) continue

            const pkgJson = resolve(dir, entry.name, 'package.json')
            if (!statSafe(pkgJson)) continue

            layers.push(`${group}/${entry.name}`)
        }
    }

    return layers
}

const LAYERS = discoverLayers()

/** 包内禁止使用的宿主别名（Nuxt Layer 里它们都解析到宿主项目） */
const BANNED_IMPORT = /['"](?:~\/|@\/|~~\/|#server\/|#shared\/)/

/** 解构 `$` 前缀的 i18n 属性：会把全局属性变成 setup 变量 */
const DOLLAR_DESTRUCTURE = /\{\s*\$[A-Za-z_]\w*\s*(?:,\s*\$[A-Za-z_]\w*\s*)*\}\s*=\s*use(?:I18n|NuxtApp)\(\)/

const problems = []
const warnings = []

const addProblem = (rule, file, detail) => problems.push({ rule, file, detail })
const addWarning = (rule, file, detail) => warnings.push({ rule, file, detail })

const rel = (p) => relative(ROOT, p).replace(/\\/g, '/')

function walk(dir, out = []) {
    if (!dir || !statSafe(dir)) return out

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === 'dist') continue
        // public/ 下是第三方静态资源（如 swagger-ui 的压缩 js），不参与源码规则
        if (entry.name === 'public') continue

        const full = join(dir, entry.name)

        if (entry.isDirectory()) {
            walk(full, out)
        }
        else if (/\.(ts|vue|mjs|js)$/.test(entry.name)) {
            out.push(full)
        }
    }

    return out
}

function statSafe(p) {
    try {
        return statSync(p)
    }
    catch {
        return null
    }
}

function readJson(p) {
    try {
        return JSON.parse(readFileSync(p, 'utf8'))
    }
    catch {
        return null
    }
}

// ---------------------------------------------------------------------------
// 1. 单例依赖扩散
//
// 只检查两件事，避免误伤正常结构：
//   a) 业务层（admin-trade）不得把单例库放进 dependencies —— 它是"插件层"，
//      必须由宿主提供，否则 pnpm 会因 peer 组合不同生成第二份实例；
//   b) 如果 node_modules 已安装，直接比对各包对同一库的物理链接，
//      指向不同 .pnpm 目录即视为已经分叉（这是运行时真正会发生的事）。
// ---------------------------------------------------------------------------
function checkSingletonDeps() {
    // a) 业务层必须用 peerDependencies（只约束运行时单例）
    //    "业务层" = packages/ 下除唯一提供者之外的包；apps/* 是宿主，允许用 dependencies。
    for (const layer of LAYERS) {
        if (!layer.startsWith('packages/') || layer === PROVIDER_PKG) continue

        const json = readJson(resolve(ROOT, layer, 'package.json'))
        if (!json) continue

        for (const name of Object.keys(json.dependencies ?? {})) {
            if (RUNTIME_SINGLETONS.includes(name)) {
                addProblem(
                    '单例依赖',
                    `${layer}/package.json`,
                    `"${name}" 必须放在 peerDependencies。业务层是插件层，直接依赖会因 peer 组合不同生成第二份物理实例。`
                )
            }
        }
    }

    // b) 实际链接一致性（install 之后才有意义）
    const collect = (names) => {
        const map = new Map()

        for (const layer of LAYERS) {
            const dir = resolve(ROOT, layer, 'node_modules')

            for (const name of names) {
                const p = resolve(dir, name)
                if (!statSafe(p)) continue

                let target
                try {
                    target = readlinkSync(p)
                }
                catch {
                    target = p
                }

                if (!map.has(name)) map.set(name, new Map())
                map.get(name).set(layer, target)
            }
        }

        return map
    }

    const describe = (byLayer) => {
        const short = (t) => {
            const idx = t.indexOf('.pnpm')
            if (idx < 0) return t
            return t.slice(idx + 6).split(/[\\/]/)[0]
        }
        return [...byLayer.entries()].map(([layer, target]) => `${layer} → ${short(target)}`).join('；')
    }

    for (const [name, byLayer] of collect(RUNTIME_SINGLETONS)) {
        if (new Set(byLayer.values()).size > 1) {
            addProblem(
                '单例实例',
                'node_modules',
                `"${name}" 在不同层解析到了不同物理实例（${describe(byLayer)}）。运行时两边的单例状态互不相通。` +
                `修复：把该库从非提供者的 dependencies 移除，并保证各层的 devDependencies（尤其 typescript）版本一致。`
            )
        }
    }

    for (const [name, byLayer] of collect(BUILD_FRAMEWORK_DEPS)) {
        if (new Set(byLayer.values()).size > 1) {
            addWarning(
                '构建期分叉',
                name,
                `"${name}" 在不同层的物理实例不一致（${describe(byLayer)}）。构建期框架不共享运行时状态，通常无害；如需彻底消除，统一各包声明的版本即可。`
            )
        }
    }
}

// ---------------------------------------------------------------------------
// 2 & 3. 包内源码规则
// ---------------------------------------------------------------------------
function checkPackageSources() {
    const files = walk(resolve(ROOT, 'packages'))
    const i18nFiles = new Map()

    for (const file of files) {
        const text = readFileSync(file, 'utf8')
        const fileRel = rel(file)

        text.split(/\r?\n/).forEach((line, index) => {
            if (!line.includes('import') && !line.includes('from') && !line.includes('(')) return

            if (BANNED_IMPORT.test(line)) {
                addProblem(
                    '宿主别名',
                    `${fileRel}:${index + 1}`,
                    `包内不得使用 ~/ @/ ~~/ #server/ #shared/（它们指向宿主项目，不是本包）。改用 #admin/*、#trade/* 或相对路径。`
                )
            }

            if (DOLLAR_DESTRUCTURE.test(line)) {
                const key = `${fileRel}:${index + 1}`
                if (!i18nFiles.has(key)) {
                    i18nFiles.set(key, true)
                    addWarning(
                        '解构$属性',
                        key,
                        `解构 $ 前缀属性会让它变成 setup 变量。属性存在时值相同，无副作用；但一旦 setup 中途抛错，` +
                        `这些绑定就是 undefined，页面会报 “$setup.$ts is not a function” 从而**掩盖真实错误**（本项目踩过：真正原因是 pinia 未激活）。` +
                        `新代码建议 const i18n = useI18n() 后按需取用，或用返回的 t / ts。`
                    )
                }
            }
        })
    }
}

// ---------------------------------------------------------------------------
// 4. 跨层 plugin 注入冲突
// ---------------------------------------------------------------------------
function checkProvideConflicts() {
    const layers = LAYERS
    const owners = new Map()

    for (const layer of layers) {
        const pluginDirs = [resolve(ROOT, layer, 'app/plugins'), resolve(ROOT, layer, 'plugins')]

        for (const dir of pluginDirs) {
            for (const file of walk(dir)) {
                const text = readFileSync(file, 'utf8')
                const provideBlock = /provide\s*:\s*\{([^}]*)\}/s.exec(text)
                if (!provideBlock) continue

                const keys = [...provideBlock[1].matchAll(/(\w+)\s*[:,]/g)].map(m => m[1])
                for (const key of keys) {
                    if (!owners.has(key)) owners.set(key, [])
                    owners.get(key).push(rel(file))
                }
            }
        }
    }

    for (const [key, files] of owners) {
        if (new Set(files.map(f => f.split('/').slice(0, 2).join('/'))).size > 1) {
            addProblem(
                '跨层注入',
                files.join(' + '),
                `多个层都 provide 了 "${key}"。Nuxt 的注入属性不可重定义，后注册的会抛 “Cannot redefine property: ${key}” 导致整页 500。` +
                `约定：provide 权只归 admin-core，业务层用注册表（registerXxx）扩展。`
            )
        }
    }
}

// ---------------------------------------------------------------------------
// 5. 同文件重复顶层声明（<script setup> 内）
//
// 只检查**顶层**声明：函数/回调内部的同名变量是合法的局部变量，
// 全量扫描会产生大量误报。判定方式：取脚本区里 const/let 的最小缩进作为顶层缩进。
// ---------------------------------------------------------------------------
function checkDuplicateDeclarations() {
    for (const file of walk(resolve(ROOT, 'packages'))) {
        if (!file.endsWith('.vue')) continue

        const text = readFileSync(file, 'utf8')
        const scriptEnd = text.indexOf('</script>')
        if (scriptEnd < 0) continue

        const script = text.slice(0, scriptEnd)
        const decls = [...script.matchAll(/^([ \t]*)(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/gm)]
        if (decls.length === 0) continue

        const minIndent = Math.min(...decls.map(m => m[1].length))
        const seen = new Map()

        for (const match of decls) {
            if (match[1].length !== minIndent) continue

            const name = match[2]
            const line = script.slice(0, match.index).split(/\r?\n/).length

            if (seen.has(name)) {
                addProblem(
                    '重复声明',
                    `${rel(file)}:${line}`,
                    `"${name}" 在同文件第 ${seen.get(name)} 行已声明。Vue 单文件组件编译会直接失败（浏览器表现为 404/白屏），不易定位。`
                )
            }
            else {
                seen.set(name, line)
            }
        }
    }
}

// ---------------------------------------------------------------------------
// 6. 跨层同名组件
// ---------------------------------------------------------------------------
function checkDuplicateComponents() {
    const layers = LAYERS
    const owners = new Map()

    for (const layer of layers) {
        for (const file of walk(resolve(ROOT, layer, 'app/components'))) {
            if (!file.endsWith('.vue')) continue
            const name = file.split(/[\\/]/).pop()
            if (!owners.has(name)) owners.set(name, [])
            owners.get(name).push(rel(file))
        }
    }

    for (const [name, files] of owners) {
        if (files.length > 1) {
            addWarning(
                '同名组件',
                files.join(' + '),
                `"${name}" 在多个层定义。Nuxt 会按优先级去重，但模板的自动导入类型推断可能整体退化（表现为大量 “Property '$xxx' does not exist”）。建议改用注册表/插槽扩展。`
            )
        }
    }
}

// ---------------------------------------------------------------------------
// 运行
// ---------------------------------------------------------------------------
checkSingletonDeps()
checkPackageSources()
checkProvideConflicts()
checkDuplicateDeclarations()
checkDuplicateComponents()

if (jsonOutput) {
    console.log(JSON.stringify({ problems, warnings }, null, 2))
}
else {
    const group = (list) => {
        const map = new Map()
        for (const item of list) {
            if (!map.has(item.rule)) map.set(item.rule, [])
            map.get(item.rule).push(item)
        }
        return map
    }

    if (problems.length === 0 && warnings.length === 0) {
        console.log('✓ 分层契约检查通过：没有发现跨层问题。')
    }

    for (const [rule, items] of group(problems)) {
        console.log(`\n✗ ${rule}（${items.length}）`)
        for (const item of items) {
            console.log(`  ${item.file}`)
            console.log(`    ${item.detail}`)
        }
    }

    for (const [rule, items] of group(warnings)) {
        console.log(`\n⚠ ${rule}（${items.length}，不阻断）`)
        for (const item of items.slice(0, 5)) {
            console.log(`  ${item.file}`)
            if (item.detail) console.log(`    ${item.detail}`)
        }
        if (items.length > 5) {
            console.log(`  … 其余 ${items.length - 5} 条省略（加 --json 可看全量）`)
        }
    }

    if (problems.length > 0) {
        console.log(`\n合计：${problems.length} 个必须修复的问题，${warnings.length} 个提示。`)
    }
}

process.exit(problems.length > 0 ? 1 : 0)
