/**
 * `GET /llms-full.txt` —— 全量文档的纯文本版，供 AI 工具一次性读取。
 *
 * 为什么不用 `nuxt-llms` 的 `full`：
 * 那条链路由 `@nuxt/content` 的 llms 特性实现，它会把每篇文档的 AST 重新序列化回 markdown
 * （`minimark` → `remark-mdc` 的 stringify）。实测本仓库 91 篇文档里有 82 篇会在
 * `mdast-util-to-markdown` 的 `strong` 处理里栈溢出（`RangeError: Maximum call stack size exceeded`），
 * 导致 `/llms-full.txt` 预渲染 500、CI 构建失败。
 *
 * 这里直接拼接**原始 markdown**：
 * - 零渲染风险（不解析 AST，不做高亮）；
 * - 对 LLM 反而更友好（保留表格、代码块、列表的原始形态）；
 * - 文档通过 `nitro.serverAssets` 打进产物，运行时无需源码目录。
 *
 * 索引（`/llms.txt`）仍由 `nuxt-llms` 提供，两者分工：索引给目录，本文件给全文。
 */
export default defineEventHandler(async (event) => {
  const storage = useStorage('assets:docs-main')

  const keys = (await storage.getKeys())
    .filter(key => key.endsWith('.md') && !key.includes('.navigation'))
    .sort()

  const chunks: string[] = []

  for (const key of keys) {
    const raw = await storage.getItem<string>(key)

    if (!raw) {
      continue
    }

    // 保留 front-matter 里的 title/description 作为标题与摘要，正文去掉 front-matter
    const frontMatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
    const title = frontMatter?.[1]?.match(/^title:\s*(.+)$/m)?.[1]?.trim()
    const description = frontMatter?.[1]?.match(/^description:\s*(.+)$/m)?.[1]?.trim()
    const body = frontMatter ? raw.slice(frontMatter[0].length) : raw

    const header = [`<!-- source: doc/main/${key.replace(/:/g, '/')} -->`]

    if (title) {
      header.push(`# ${title}`)
    }
    if (description) {
      header.push(`> ${description}`)
    }

    chunks.push(`${header.join('\n')}\n\n${body.trim()}`)
  }

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600')

  return `${chunks.join('\n\n---\n\n')}\n`
})
