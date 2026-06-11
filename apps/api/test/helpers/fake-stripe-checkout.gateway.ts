import Stripe from 'stripe'
import {
  ExpireCheckoutSessionError,
  ExpireCheckoutSessionResult,
  StripeCheckoutGateway,
} from '../../src/commandes/stripe-checkout.gateway'

type CheckoutSession = Awaited<
  ReturnType<StripeCheckoutGateway['createCheckoutSession']>
>

export class FakeStripeCheckoutGateway {
  readonly createdSessions: {
    params: Parameters<StripeCheckoutGateway['createCheckoutSession']>[0]
    options?: Parameters<StripeCheckoutGateway['createCheckoutSession']>[1]
  }[] = []
  readonly expiredSessions: string[] = []
  private nextSession: CheckoutSession = {
    id: 'cs_test_e2e_success',
    object: 'checkout.session',
    url: 'https://checkout.stripe.test/e2e',
  } as CheckoutSession
  private nextError: Error | null = null
  private nextExpirationError: Error | null = null
  private nextExpirationResult: ExpireCheckoutSessionResult | null = null

  reset() {
    this.createdSessions.length = 0
    this.expiredSessions.length = 0
    this.nextError = null
    this.nextExpirationError = null
    this.nextExpirationResult = null
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

  failNextExpiration(
    error = new ExpireCheckoutSessionError('Stripe expiration unavailable'),
  ) {
    this.nextExpirationError = error
  }

  setNextExpirationResult(result: ExpireCheckoutSessionResult) {
    this.nextExpirationResult = result
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

  expireCheckoutSession(sessionId: string) {
    this.expiredSessions.push(sessionId)

    if (this.nextExpirationError) {
      const error = this.nextExpirationError
      this.nextExpirationError = null
      return Promise.reject(error)
    }

    if (this.nextExpirationResult) {
      const result = this.nextExpirationResult
      this.nextExpirationResult = null
      return Promise.resolve(result)
    }

    return Promise.resolve({
      expired: true,
      alreadyFinal: false,
    } satisfies ExpireCheckoutSessionResult)
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
