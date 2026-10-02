/**
 * 浏览器端文本文件下载工具（零依赖）。
 *
 * 用途：服务端（tRPC）生成 CSV 文本，前端拿到 `{ filename, content }` 后触发下载。
 * - 自动加 UTF-8 BOM，Excel 打开中文不乱码；
 * - 下载完成后立刻释放 ObjectURL，避免内存泄漏。
 */

/**
 * 触发浏览器下载一段文本。
 *
 * @param filename 文件名（含扩展名）
 * @param content  文本内容
 * @param mime      MIME 类型，CSV 用 `text/csv;charset=utf-8`
 */
export function downloadTextFile(
  filename: string,
  content: string,
  mime = 'text/csv;charset=utf-8'
) {
  // 已有 BOM 就不重复添加（服务端 buildCsv 已经带了）
  const text = content.startsWith('\uFEFF') ? content : `\uFEFF${content}`
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)

  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } finally {
    // Safari 需要延迟释放，否则下载会被中断
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
