import Stripe from 'stripe'

export function createSignedStripeEvent(data: {
  id: string
  type: string
  sessionId: string
}) {
  const payload = JSON.stringify({
    id: data.id,
    object: 'event',
    type: data.type,
    data: {
      object: {
        id: data.sessionId,
        object: 'checkout.session',
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
