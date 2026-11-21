#!/usr/bin/env node
/**
 * 文档站结构校验（零依赖）。
 *
 * 为什么需要它：这几轮人工审计反复发现同一类问题 ——
 *   站内死链、缺 `.navigation.yml`、缺 `title`、孤儿页、以及文档里引用的源码路径已不存在。
 * 把五类问题脚本化，改动文档后跑一次即可，不必靠人肉复查。
 *
 * 校验项（任一 error 即非 0 退出）：
 *   1. 每个 .md 都有 front-matter `title`
 *   2. 每个目录都有 `.navigation.yml`
 *   3. 站内 `/docs/main/...` 链接目标存在（warn：指向没有 index 页的分区根）
 *   4. 反引号里的源码路径（apps/… packages/… server/… 等）真实存在
 *   5. 孤儿页（除 index 外没有任何入链）
 *
 * 用法：
 *   node scripts/check-docs.mjs            # 人类可读报告
 *   node scripts/check-docs.mjs --json     # 机器可读
 *   node scripts/check-docs.mjs --root=apps/demo/doc/main
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'

const args = process.argv.slice(2)
const JSON_OUT = args.includes('--json')
const rootArg = args.find(a => a.startsWith('--root='))
const DOC_ROOT = rootArg ? rootArg.slice('--root='.length) : 'apps/demo/doc/main'
const REPO_ROOT = process.cwd()

/** 源码路径可能相对仓库根，也可能相对某个包根；逐一尝试 */
const PATH_ROOTS = ['.', 'packages/admin-core', 'packages/admin-trade', 'apps/demo']

const errors = []
const warns = []
const pages = new Map() // url -> { file, title }

function err(file, message, line) {
  errors.push({ file, line, message })
}
function warn(file, message, line) {
  warns.push({ file, line, message })
}

/** 目录项排序：数字前缀优先，其余按字典序（与侧边栏一致） */
function sortEntries(entries) {
  return entries.sort((a, b) => {
    const na = Number(a.name.match(/^(\d+)\./)?.[1] ?? Number.MAX_SAFE_INTEGER)
    const nb = Number(b.name.match(/^(\d+)\./)?.[1] ?? Number.MAX_SAFE_INTEGER)
    return na === nb ? a.name.localeCompare(b.name) : na - nb
  })
}

/** `1.getting-started/4.docs-guide.md` → `getting-started/docs-guide`；`…/1.index.md` → 目录根 */
function toUrl(relPath) {
  const segs = relPath.split(/[\\/]/)
  const mapped = segs.map(seg => seg.replace(/^\d+\./, ''))
  const last = mapped[mapped.length - 1]
  if (last === 'index.md' || last === 'index') {
    mapped.pop()
  }
  else if (last.endsWith('.md')) {
    mapped[mapped.length - 1] = last.slice(0, -3)
  }
  return '/docs/main' + (mapped.length ? '/' + mapped.join('/') : '')
}

function walk(dir) {
  const entries = sortEntries(readdirSync(dir, { withFileTypes: true }))
  const isRoot = dir === DOC_ROOT

  if (!isRoot && !entries.some(e => e.name === '.navigation.yml')) {
    err(relative(REPO_ROOT, dir) + '/', '缺少 .navigation.yml（侧边栏标题/图标/排序来源）')
  }

  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
      continue
    }
    if (!entry.name.endsWith('.md')) continue

    const rel = relative(DOC_ROOT, full)
    const raw = readFileSync(full, 'utf8')
    const title = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1]?.match(/^title:\s*(.+)$/m)?.[1]?.trim()
    if (!title) {
      err(relative(REPO_ROOT, full), '缺少 front-matter title')
    }
    pages.set(toUrl(rel), { file: relative(REPO_ROOT, full), title: title ?? '' })
  }
}

walk(DOC_ROOT)

/** 分区根（有 .navigation.yml 的目录）—— 允许被链接，但会提示缺 index 页 */
const sectionRoots = new Set()
function collectSections(dir) {
  const entries = sortEntries(readdirSync(dir, { withFileTypes: true }))
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const full = join(dir, entry.name)
    if (existsSync(join(full, '.navigation.yml'))) {
      sectionRoots.add(toUrl(relative(DOC_ROOT, full) + '/x').replace(/\/x$/, ''))
      collectSections(full)
    }
  }
}
collectSections(DOC_ROOT)

const inbound = new Map([...pages.keys()].map(url => [url, 0]))

/** 逐页做链接与源码路径校验 */
for (const [url, page] of pages) {
  const raw = readFileSync(join(REPO_ROOT, page.file), 'utf8')
  const lines = raw.split(/\r?\n/)

  lines.forEach((text, index) => {
    const lineNo = index + 1

    // 3) 站内链接：同时认 Markdown 链接与反引号里的裸路径（项目文档两种写法都在用）
    const candidates = [
      ...[...text.matchAll(/\]\((\/docs\/main[^)\s#]*)/g)].map(m => m[1]),
      ...[...text.matchAll(/`(\/docs\/main[^`\s#]*)`/g)].map(m => m[1])
    ]

    for (const rawTarget of candidates) {
      const target = rawTarget.replace(/\/$/, '')
      // 文档里用于演示 URL 格式的占位符（/docs/main/**、/docs/main/...、<slug>）不是真链接
      if (/[*]|\.\.\.|[<>{}]/.test(target)) continue
      if (pages.has(target)) {
        if (target !== url) inbound.set(target, (inbound.get(target) ?? 0) + 1)
        continue
      }
      if (sectionRoots.has(target)) {
        warn(page.file, `链接指向分区根 ${target}，但该分区没有 index 页（建议指向具体页）`, lineNo)
        continue
      }
      err(page.file, `站内死链 ${target}`, lineNo)
    }

    // 4) 源码路径引用（反引号包裹）
    //    只校验「看起来是仓库路径」的引用：必须带目录前缀（apps/ packages/ server/ app/ shared/ scripts/ sql/），
    //    裸文件名（如 `.navigation.yml`、`index.vue`）是「当前目录某文件」的叙述，跳过以免噪声。
    for (const match of text.matchAll(/`([A-Za-z0-9_@#./-]+\.(?:ts|vue|mjs|json|sql|yml))(?::\d+(?:-\d+)?)?`/g)) {
      let raw4 = match[1]
      if (/^(https?:|\.\.\/|\/)/.test(raw4)) continue

      // 别名 → 真实包路径
      raw4 = raw4.replace(/^#admin\//, 'packages/admin-core/').replace(/^#trade\//, 'packages/admin-trade/')

      const looksLikeRepoPath = /(^|\/)(apps|packages|scripts|sql|docs?)\//.test(raw4)
        || /^(server|app|shared)\//.test(raw4)
      if (!looksLikeRepoPath) continue
      // 占位符（如 `server/.../Xxx.ts`）不是真实路径
      if (/\.\.\.|\bXxx\b|[<>{}*]/.test(raw4)) continue

      const found = PATH_ROOTS.some(base => existsSync(join(REPO_ROOT, base, raw4)))
      if (!found) {
        err(page.file, `引用的文件不存在：${raw4}`, lineNo)
      }
    }

    // 3b) 提醒：正文仍在使用「文件:行」形式的引用（行号必然漂移）
    if (/`[A-Za-z0-9_@./-]+\.(?:ts|vue)`:(\d+)(?:-\d+)?/.test(text)) {
      warn(page.file, '使用了「文件:行」引用，建议改为「符号名 + 文件路径」（行号会漂移）', lineNo)
    }
  })
}

// 5) 孤儿页
for (const [url, page] of pages) {
  if (/\/index$/.test(url) || url === '/docs/main') continue
  if ((inbound.get(url) ?? 0) === 0) {
    warn(page.file, '孤儿页：没有任何其它页面链接到它')
  }
}

/** 输出 */
if (JSON_OUT) {
  console.log(JSON.stringify({ pages: pages.size, errors, warns }, null, 2))
}
else {
  console.log(`文档页数：${pages.size}　分区数：${sectionRoots.size}`)
  if (errors.length) {
    console.log(`\n✗ 错误 ${errors.length} 条：`)
    for (const e of errors) console.log(`  ${e.file}${e.line ? ':' + e.line : ''}  ${e.message}`)
  }
  if (warns.length) {
    console.log(`\n⚠ 警告 ${warns.length} 条：`)
    for (const w of warns) console.log(`  ${w.file}${w.line ? ':' + w.line : ''}  ${w.message}`)
  }
  if (!errors.length && !warns.length) console.log('\n✓ 全部通过')
}

process.exit(errors.length ? 1 : 0)
