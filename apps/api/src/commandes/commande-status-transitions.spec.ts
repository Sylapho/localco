import {
  canTransitionOrderStatus,
  ORDER_STATUS_TRANSITIONS,
} from './commande-status-transitions'

describe('commande status transitions', () => {
  it.each([
    ['paiement_en_attente', 'nouvelle'],
    ['paiement_en_attente', 'annulee'],
    ['paiement_a_verifier', 'annulee'],
    ['nouvelle', 'preparee'],
    ['nouvelle', 'annulee'],
    ['preparee', 'traitee'],
    ['preparee', 'annulee'],
  ])('allows %s -> %s', (currentStatus, nextStatus) => {
    expect(canTransitionOrderStatus(currentStatus, nextStatus)).toBe(true)
  })

  it.each([
    ['paiement_en_attente', 'preparee'],
    ['paiement_a_verifier', 'nouvelle'],
    ['nouvelle', 'traitee'],
    ['preparee', 'nouvelle'],
    ['traitee', 'annulee'],
    ['annulee', 'nouvelle'],
  ])('rejects %s -> %s', (currentStatus, nextStatus) => {
    expect(canTransitionOrderStatus(currentStatus, nextStatus)).toBe(false)
  })

  it('keeps terminal statuses terminal', () => {
    expect(ORDER_STATUS_TRANSITIONS.annulee).toEqual([])
    expect(ORDER_STATUS_TRANSITIONS.traitee).toEqual([])
  })
})
