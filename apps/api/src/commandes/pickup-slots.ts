import { BadRequestException } from '@nestjs/common'

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
] as const

export type PickupPoint = (typeof pickupPoints)[number]

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

  const allowedWeekdays: readonly number[] = pickupPoint.allowedWeekdays

  if (!allowedWeekdays.includes(pickupDate.getDay())) {
    throw new BadRequestException(
      'La date de retrait ne correspond pas au lieu choisi',
    )
  }
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
