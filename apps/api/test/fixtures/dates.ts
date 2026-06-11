import {
  formatPickupPoint,
  pickupPoints,
} from '../../src/commandes/pickup-slots'

export const validPickupPoint = formatPickupPoint(pickupPoints[0])

export function getNextDateForWeekday(targetWeekday: number) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)

  do {
    date.setDate(date.getDate() + 1)
  } while (date.getDay() !== targetWeekday)

  return formatDateInput(date)
}

export function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}
