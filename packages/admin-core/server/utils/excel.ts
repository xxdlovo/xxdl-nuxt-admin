import ExcelJS from 'exceljs'

/**
 * Excel 导入导出工具（仅服务端使用）。
 *
 * - 导出统一使用 xlsx，首行加粗并冻结；
 * - 导入按表头名匹配，返回 `Record<header, text>` 的数组；
 * - 所有以 = + - @ 开头的字符串在导出时加前导单引号，避免公式注入。
 */

export type ExcelColumn = {
    header: string
    key: string
    width?: number
}

export type ExcelRow = Record<string, unknown>

function escapeFormula(value: unknown) {
    if (typeof value !== 'string') {
        return value
    }

    return /^[=+\-@]/.test(value) ? `'${value}` : value
}

export async function buildExcelBuffer(options: {
    sheetName: string
    columns: ExcelColumn[]
    rows: ExcelRow[]
}) {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(options.sheetName)

    worksheet.columns = options.columns.map(column => ({
        header: column.header,
        key: column.key,
        width: column.width ?? 20,
    }))

    for (const row of options.rows) {
        worksheet.addRow(Object.fromEntries(
            options.columns.map(column => [column.key, escapeFormula(row[column.key])])
        ))
    }

    const header = worksheet.getRow(1)
    header.font = { bold: true }
    header.alignment = { vertical: 'middle' }
    worksheet.views = [{ state: 'frozen', ySplit: 1 }]

    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer as ArrayBuffer)
}

export type ParsedExcel = {
    headers: string[]
    rows: Array<Record<string, string>>
}

export async function parseExcelBuffer(buffer: Buffer): Promise<ParsedExcel> {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as any)

    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
        return { headers: [], rows: [] }
    }

    const headerRow = worksheet.getRow(1)
    const headers: string[] = []
    const columnCount = headerRow.cellCount

    for (let index = 1; index <= columnCount; index += 1) {
        headers.push(String(headerRow.getCell(index).text ?? '').trim())
    }

    const rows: Array<Record<string, string>> = []
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
            return
        }

        const record: Record<string, string> = {}
        let hasValue = false

        headers.forEach((header, index) => {
            if (!header) {
                return
            }

            const text = String(row.getCell(index + 1).text ?? '').trim()
            record[header] = text
            if (text) {
                hasValue = true
            }
        })

        if (hasValue) {
            rows.push(record)
        }
    })

    return { headers, rows }
}

/** 生成带时间戳的 xlsx 文件名 */
export function buildExcelFilename(prefix: string, date: Date = new Date()) {
    const pad = (value: number) => String(value).padStart(2, '0')
    const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
        + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`

    return `${prefix}-${stamp}.xlsx`
}
