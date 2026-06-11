export const ORDER_STATUSES = [
  'paiement_en_attente',
  'paiement_a_verifier',
  'nouvelle',
  'preparee',
  'traitee',
  'annulee',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_STATUS_TRANSITIONS: Readonly<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  paiement_en_attente: ['nouvelle', 'annulee'],
  paiement_a_verifier: ['annulee'],
  nouvelle: ['preparee', 'annulee'],
  preparee: ['traitee', 'annulee'],
  traitee: [],
  annulee: [],
}

export function isOrderStatus(status: string): status is OrderStatus {
  return ORDER_STATUSES.includes(status as OrderStatus)
}

export function canTransitionOrderStatus(
  currentStatus: string,
  nextStatus: string,
) {
  if (!isOrderStatus(currentStatus) || !isOrderStatus(nextStatus)) {
    return false
  }

  return ORDER_STATUS_TRANSITIONS[currentStatus].includes(nextStatus)
}

export function isTerminalOrderStatus(status: string) {
  return status === 'annulee' || status === 'traitee'
}
