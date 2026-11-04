const FIELD_RANGES = [
    [0, 59], // seconds
    [0, 59], // minutes
    [0, 23], // hours
    [1, 31], // day of month
    [1, 12], // month
    [0, 7], // day of week, 0 and 7 both mean Sunday
] as const

const MONTH_ALIASES: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
}

const WEEKDAY_ALIASES: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
}

type CronFields = [Set<number>, Set<number>, Set<number>, Set<number>, Set<number>, Set<number>]

function parseCronValue(value: string, index: number) {
    const lower = value.toLowerCase()
    const aliases = index === 4
        ? MONTH_ALIASES
        : index === 5
            ? WEEKDAY_ALIASES
            : undefined
    const parsed = aliases?.[lower] ?? Number(value)

    if (!Number.isInteger(parsed)) {
        throw new Error('Invalid cron value')
    }
    return parsed
}

function normalizeCronValue(value: number, max: number) {
    return value === 7 && max === 7 ? 0 : value
}

function parsePart(part: string, min: number, max: number, index: number) {
    const values = new Set<number>()

    for (const segment of part.split(',')) {
        const [rangePartRaw, stepPart] = segment.split('/')
        const rangePart = rangePartRaw === '?' ? '*' : rangePartRaw
        if (!rangePart) {
            throw new Error('Invalid cron range')
        }
        const step = stepPart ? Number(stepPart) : 1
        if (!Number.isInteger(step) || step < 1) {
            throw new Error('Invalid cron step')
        }

        const [startText, endText] = (() => {
            if (rangePart === '*') {
                return [String(min), String(max)]
            }

            const [start, end] = rangePart.split('-')
            if (!start) {
                throw new Error('Invalid cron range')
            }
            // 兼容 node-cron/常见 cron 写法里的 0/20：从指定值开始，按步长直到字段上限。
            // 原实现会把 0/20 当成只包含 0，导致“每 20 分钟”这类任务无法正确计算下次执行时间。
            if (stepPart && end == null) {
                return [start, String(max)]
            }

            return [start, end]
        })()
        if (!startText) {
            throw new Error('Invalid cron range')
        }

        const start = parseCronValue(startText, index)
        const end = parseCronValue(endText ?? startText, index)
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) {
            throw new Error('Invalid cron range')
        }

        for (let value = start; value <= end; value += step) {
            values.add(normalizeCronValue(value, max))
        }
    }

    return values
}

function parseCron(expression: string) {
    const sourceParts = expression.trim().split(/\s+/)
    if (sourceParts.length !== 5 && sourceParts.length !== 6) {
        throw new Error('Cron expression must contain 5 or 6 fields')
    }
    // node-cron 的秒字段可选；5 位表达式按每分钟第 0 秒执行处理。
    const parts = sourceParts.length === 5 ? ['0', ...sourceParts] : sourceParts

    return parts.map((part, index) => {
        const range = FIELD_RANGES[index]
        if (!range) {
            throw new Error('Invalid cron field')
        }
        return parsePart(part, range[0], range[1], index)
    }) as CronFields
}

function matches(date: Date, fields: CronFields) {
    return fields[0].has(date.getSeconds())
        && fields[1].has(date.getMinutes())
        && fields[2].has(date.getHours())
        && fields[3].has(date.getDate())
        && fields[4].has(date.getMonth() + 1)
        && fields[5].has(date.getDay())
}

export function assertValidCron(expression: string) {
    parseCron(expression)
}

export function nextRunAt(expression: string, from = new Date()) {
    const fields = parseCron(expression)
    const cursor = new Date(from)
    cursor.setMilliseconds(0)
    cursor.setSeconds(cursor.getSeconds() + 1)

    for (let i = 0; i < 366 * 24 * 60 * 60; i++) {
        if (matches(cursor, fields)) {
            return cursor
        }
        cursor.setSeconds(cursor.getSeconds() + 1)
    }

    throw new Error('Unable to calculate next run time')
}

export function formatMysqlDate(date = new Date()) {
    const pad = (value: number) => String(value).padStart(2, '0')
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
    ].join('-') + ' ' + [
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds())
    ].join(':')
}
