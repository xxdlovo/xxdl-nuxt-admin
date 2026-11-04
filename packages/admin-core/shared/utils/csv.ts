/**
 * CSV 生成工具（服务端生成文本，前端用 Blob 触发下载）。
 *
 * 约定：
 * - 统一输出 UTF-8 BOM，Excel 直接双击打开中文不乱码；
 * - 字段按 RFC 4180 转义：包含逗号、引号、换行时用双引号包裹，内部引号翻倍；
 * - 不做类型转换，调用方负责把值转成字符串（金额请保持两位小数字符串）。
 */

/** 单个字段转义 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  const text = String(value)

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

/**
 * 生成 CSV 文本。
 *
 * @param headers 表头（第一行）
 * @param rows    数据行（每行元素顺序需与表头一致）
 */
export function buildCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(escapeCsvField).join(',')]

  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(','))
  }

  // 前置 BOM，保证 Excel 识别为 UTF-8
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

/** 生成带时间戳的导出文件名，如 `balance-log-20260101-120000.csv` */
export function buildCsvFilename(prefix: string, date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`

  return `${prefix}-${stamp}.csv`
}
