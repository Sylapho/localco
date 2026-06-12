export type PickupPoint = {
  label: string
  schedule: string
  allowedWeekdays: number[]
  alternatingWeekAnchorDate?: string
  value: string
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const AMAP_ALTERNATION_DAYS = 14

const weekdayLabels = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
]

function formatInputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseInputDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  return new Date(year, month - 1, day)
}

function getUtcDayNumber(date: Date) {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
      MS_PER_DAY,
  )
}

function isPickupDateAllowed(point: PickupPoint, date: Date) {
  if (!point.allowedWeekdays.includes(date.getDay())) {
    return false
  }

  if (!point.alternatingWeekAnchorDate) {
    return true
  }

  const anchorDate = parseInputDate(point.alternatingWeekAnchorDate)

  return (
    (getUtcDayNumber(date) - getUtcDayNumber(anchorDate)) %
      AMAP_ALTERNATION_DAYS ===
    0
  )
}

export function formatPickupPoint(point: PickupPoint) {
  return point.value
}

export function findPickupPoint(
  pickupPoints: readonly PickupPoint[],
  value: string,
) {
  return pickupPoints.find((point) => point.value === value)
}

export function getAllowedPickupWeekdays(point?: PickupPoint) {
  if (!point) {
    return ''
  }

  return point.allowedWeekdays
    .map((weekday) => weekdayLabels[weekday])
    .join(', ')
}

export function getNextPickupDates(point: PickupPoint, count = 8) {
  const dates: string[] = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  while (dates.length < count) {
    if (isPickupDateAllowed(point, cursor)) {
      dates.push(formatInputDate(cursor))
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

export function formatPickupDateLabel(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseInputDate(value))
}
