import { BadRequestException } from '@nestjs/common'

const AUTHEUIL_AUTHOUILLET_AMAP_ANCHOR_DATE = '2026-06-18'
const HOULBEC_COCHEREL_AMAP_ANCHOR_DATE = '2026-06-25'
const MS_PER_DAY = 24 * 60 * 60 * 1000
const AMAP_ALTERNATION_DAYS = 14

export type PickupPoint = {
  label: string
  schedule: string
  allowedWeekdays: readonly number[]
  alternatingWeekAnchorDate?: string
}

export const pickupPoints: readonly PickupPoint[] = [
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
    alternatingWeekAnchorDate: HOULBEC_COCHEREL_AMAP_ANCHOR_DATE,
  },
  {
    label: 'AMAP Autheuil-Authouillet',
    schedule: 'Jeudi, tous les 15 jours',
    allowedWeekdays: [4],
    alternatingWeekAnchorDate: AUTHEUIL_AUTHOUILLET_AMAP_ANCHOR_DATE,
  },
] as const

export function formatPickupPoint(point: PickupPoint) {
  return `${point.label} - ${point.schedule}`
}

export function getPublicPickupPoints() {
  return pickupPoints.map((point) => ({
    ...point,
    value: formatPickupPoint(point),
  }))
}

export function findPickupPoint(value: string) {
  return pickupPoints.find((point) => formatPickupPoint(point) === value)
}

export function validatePickupSlot(lieu: string, dateRetrait?: string) {
  const pickupPoint = findPickupPoint(lieu)

  if (!pickupPoint) {
    throw new BadRequestException('Lieu de retrait invalide')
  }

  if (!dateRetrait) {
    throw new BadRequestException('Date de retrait obligatoire')
  }

  const pickupDate = parsePickupDate(dateRetrait)

  if (!pickupDate) {
    throw new BadRequestException('Date de retrait invalide')
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (pickupDate < today) {
    throw new BadRequestException('La date de retrait ne peut pas être passée')
  }

  if (!isPickupDateAllowed(pickupPoint, pickupDate)) {
    throw new BadRequestException(
      'La date de retrait ne correspond pas au lieu choisi',
    )
  }
}

export function isPickupDateAllowed(point: PickupPoint, date: Date) {
  if (!point.allowedWeekdays.includes(date.getDay())) {
    return false
  }

  if (!point.alternatingWeekAnchorDate) {
    return true
  }

  const anchorDate = parsePickupDate(point.alternatingWeekAnchorDate)

  if (!anchorDate) {
    return false
  }

  return (
    (getUtcDayNumber(date) - getUtcDayNumber(anchorDate)) %
      AMAP_ALTERNATION_DAYS ===
    0
  )
}

function parsePickupDate(value: string) {
  const datePart = value.slice(0, 10)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart)

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  date.setHours(0, 0, 0, 0)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

function getUtcDayNumber(date: Date) {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY,
  )
}
