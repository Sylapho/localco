import Stripe from 'stripe'

export function createSignedStripeEvent(data: {
  id: string
  type: string
  sessionId: string
  paymentStatus?: string
  amountTotal?: number
  currency?: string
  commandeId?: number
  clientReferenceId?: string
}) {
  const payload = JSON.stringify({
    id: data.id,
    object: 'event',
    type: data.type,
    data: {
      object: {
        id: data.sessionId,
        object: 'checkout.session',
        payment_status: data.paymentStatus ?? 'paid',
        amount_total: data.amountTotal ?? 1250,
        currency: data.currency ?? 'eur',
        client_reference_id:
          data.clientReferenceId ??
          (data.commandeId !== undefined ? String(data.commandeId) : undefined),
        metadata:
          data.commandeId !== undefined
            ? {
                commandeId: String(data.commandeId),
              }
            : undefined,
      },
    },
  })
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_localco_e2e_secret'
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  })

  return { payload, signature }
}
