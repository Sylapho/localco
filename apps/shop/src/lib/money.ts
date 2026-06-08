export function eurosToCents(value: number) {
  return Math.round(value * 100)
}

export function centsToEuros(value: number) {
  return value / 100
}

export function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(centsToEuros(value))
}
