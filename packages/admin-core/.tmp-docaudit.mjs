import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = 'apps/demo/doc/main'

function walk(dir, depth = 0) {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
  const hasNav = entries.some(e => e.name === '.navigation.yml')
  const md = entries.filter(e => e.isFile() && e.name.endsWith('.md'))
  const dirs = entries.filter(e => e.isDirectory())
  const other = entries.filter(e => e.isFile() && !e.name.endsWith('.md') && e.name !== '.navigation.yml')

  console.log(`${'  '.repeat(depth)}${join(dir).replace(root, '').replace(/^[\\/]/, '') || '(root)'}/  nav=${hasNav ? 'Y' : 'N'}  md=${md.length}${other.length ? '  other=' + other.map(o => o.name).join(',') : ''}`)
  for (const f of md) {
    const raw = readFileSync(join(dir, f.name), 'utf8')
    const title = raw.match(/^title:\s*(.+)$/m)?.[1]?.trim() ?? '(no title)'
    console.log(`${'  '.repeat(depth + 1)}- ${f.name}  「${title}」`)
  }
  for (const d of dirs) walk(join(dir, d.name), depth + 1)
}

walk(root)

console.log('\n=== index.md 里出现的分区链接 ===')
const index = readFileSync(join(root, 'index.md'), 'utf8')
const links = [...index.matchAll(/\]\((\/docs\/main\/[a-z0-9-]+)/g)].map(m => m[1])
console.log([...new Set(links)].join('\n'))
