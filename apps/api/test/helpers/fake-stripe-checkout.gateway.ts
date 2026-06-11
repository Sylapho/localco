import Stripe from 'stripe'
import { StripeCheckoutGateway } from '../../src/commandes/stripe-checkout.gateway'

type CheckoutSession = Awaited<
  ReturnType<StripeCheckoutGateway['createCheckoutSession']>
>

export class FakeStripeCheckoutGateway {
  readonly createdSessions: {
    params: Parameters<StripeCheckoutGateway['createCheckoutSession']>[0]
    options?: Parameters<StripeCheckoutGateway['createCheckoutSession']>[1]
  }[] = []
  private nextSession: CheckoutSession = {
    id: 'cs_test_e2e_success',
    object: 'checkout.session',
    url: 'https://checkout.stripe.test/e2e',
  } as CheckoutSession
  private nextError: Error | null = null

  reset() {
    this.createdSessions.length = 0
    this.nextError = null
    this.nextSession = {
      id: 'cs_test_e2e_success',
      object: 'checkout.session',
      url: 'https://checkout.stripe.test/e2e',
    } as CheckoutSession
  }

  setNextSession(session: Pick<CheckoutSession, 'id' | 'url'>) {
    this.nextSession = {
      id: session.id,
      object: 'checkout.session',
      url: session.url,
    } as CheckoutSession
  }

  failNextSession(error = new Error('Stripe unavailable')) {
    this.nextError = error
  }

  createCheckoutSession(
    params: Parameters<StripeCheckoutGateway['createCheckoutSession']>[0],
    options?: Parameters<StripeCheckoutGateway['createCheckoutSession']>[1],
  ) {
    this.createdSessions.push({ params, options })

    if (this.nextError) {
      const error = this.nextError
      this.nextError = null
      return Promise.reject(error)
    }

    return Promise.resolve(this.nextSession)
  }

  constructWebhookEvent(
    rawBody: Buffer,
    signature: string,
    webhookSecret: string,
  ) {
    const stripe = new Stripe('sk_test_localco_e2e')

    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  }
}
