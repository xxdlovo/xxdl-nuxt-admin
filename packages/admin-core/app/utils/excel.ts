/**
 * Excel 导出/导入的前端辅助。
 *
 * 导出用原生 fetch 取 Blob，避免 tRPC 响应体限制；
 * 导入用 FormData，直接走后端 multipart 路由。
 */

export type ExcelExportModule = 'user' | 'role' | 'post' | 'systemLog' | 'loginLog'

function parseFilename(disposition: string | null, fallback: string) {
    if (!disposition) {
        return fallback
    }

    const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
    if (utf8?.[1]) {
        return decodeURIComponent(utf8[1])
    }

    const plain = /filename="?([^";]+)"?/i.exec(disposition)
    return plain?.[1] || fallback
}

function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
}

export async function downloadExcel(module: ExcelExportModule, filters: Record<string, unknown> = {}) {
    const response = await fetch('/api/system/excel/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, filters }),
    })

    if (!response.ok) {
        throw new Error(await response.text() || '导出失败')
    }

    const blob = await response.blob()
    saveBlob(blob, parseFilename(response.headers.get('content-disposition'), `${module}.xlsx`))
}

/** 浏览器直接下载模板，Cookie 会自动带上 */
export function downloadExcelTemplate(module = 'user') {
    const link = document.createElement('a')
    link.href = `/api/system/excel/template?module=${encodeURIComponent(module)}`
    link.download = 'user-import-template.xlsx'
    document.body.appendChild(link)
    link.click()
    link.remove()
}

export type ExcelImportResult = {
    total: number
    successCount: number
    failedCount: number
    errors: Array<{ row: number, message: string }>
}

export async function importExcel(module: 'user', file: File) {
    const form = new FormData()
    form.append('module', module)
    form.append('file', file)

    const response = await $fetch<{ success: boolean, data: ExcelImportResult }>('/api/system/excel/import', {
        method: 'POST',
        body: form,
    })

    return response.data
}
