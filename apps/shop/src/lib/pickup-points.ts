export const pickupPoints = [
  {
    label: 'Marché de Gaillon',
    schedule: 'Mardi matin, 8h-12h',
    allowedWeekdays: [2],
  },
  {
    label: 'Marché du Neubourg',
    schedule: 'Mercredi matin, 8h-12h',
    allowedWeekdays: [3],
  },
  {
    label: 'Marché de Conches',
    schedule: 'Jeudi matin, 8h-12h',
    allowedWeekdays: [4],
  },
  {
    label: 'À la ferme',
    schedule: 'Vendredi après-midi, 16h-18h',
    allowedWeekdays: [5],
  },
  {
    label: 'À la ferme',
    schedule: 'Samedi matin, 8h-12h',
    allowedWeekdays: [6],
  },
  {
    label: "AMAP d'Houlbec-Cocherel",
    schedule: 'Jeudi, tous les 15 jours',
    allowedWeekdays: [4],
  },
  {
    label: 'AMAP Autheuil-Authouillet',
    schedule: 'Jeudi, tous les 15 jours',
    allowedWeekdays: [4],
  },
]

export type PickupPoint = (typeof pickupPoints)[number]

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

export function formatPickupPoint(point: PickupPoint) {
  return `${point.label} - ${point.schedule}`
}

export function findPickupPoint(value: string) {
  return pickupPoints.find((point) => formatPickupPoint(point) === value)
}

export function getAllowedPickupWeekdays(point: PickupPoint) {
  return point.allowedWeekdays
    .map((weekday) => weekdayLabels[weekday])
    .join(', ')
}

export function getNextPickupDates(point: PickupPoint, count = 8) {
  const dates: string[] = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  while (dates.length < count) {
    if (point.allowedWeekdays.includes(cursor.getDay())) {
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
