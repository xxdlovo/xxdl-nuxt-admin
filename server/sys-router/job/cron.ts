const FIELD_RANGES = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
] as const

type CronFields = [Set<number>, Set<number>, Set<number>, Set<number>, Set<number>]

function parsePart(part: string, min: number, max: number) {
  const values = new Set<number>()

  for (const segment of part.split(',')) {
    const [rangePart, stepPart] = segment.split('/')
    if (!rangePart) {
      throw new Error('Invalid cron range')
    }
    const step = stepPart ? Number(stepPart) : 1
    if (!Number.isInteger(step) || step < 1) {
      throw new Error('Invalid cron step')
    }

    const [startText, endText] = rangePart === '*'
      ? [String(min), String(max)]
      : rangePart.split('-')

    const start = Number(startText)
    const end = Number(endText ?? startText)
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) {
      throw new Error('Invalid cron range')
    }

    for (let value = start; value <= end; value += step) {
      values.add(value === 7 && max === 7 ? 0 : value)
    }
  }

  return values
}

function parseCron(expression: string) {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) {
    throw new Error('Cron expression must contain 5 fields')
  }

  return parts.map((part, index) => {
    const range = FIELD_RANGES[index]
    if (!range) {
      throw new Error('Invalid cron field')
    }
    return parsePart(part, range[0], range[1])
  }) as CronFields
}

function matches(date: Date, fields: CronFields) {
  return fields[0].has(date.getMinutes())
    && fields[1].has(date.getHours())
    && fields[2].has(date.getDate())
    && fields[3].has(date.getMonth() + 1)
    && fields[4].has(date.getDay())
}

export function assertValidCron(expression: string) {
  parseCron(expression)
}

export function nextRunAt(expression: string, from = new Date()) {
  const fields = parseCron(expression)
  const cursor = new Date(from)
  cursor.setSeconds(0, 0)
  cursor.setMinutes(cursor.getMinutes() + 1)

  for (let i = 0; i < 366 * 24 * 60; i++) {
    if (matches(cursor, fields)) {
      return cursor
    }
    cursor.setMinutes(cursor.getMinutes() + 1)
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
