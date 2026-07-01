import Stripe from 'stripe'
import {
  CheckoutSessionStateResult,
  CreatedCheckoutSession,
  ExpireCheckoutSessionError,
  ExpireCheckoutSessionResult,
  StripeCheckoutGateway,
} from '../../src/commandes/stripe-checkout.gateway'

export class FakeStripeCheckoutGateway {
  readonly createdSessions: {
    params: Parameters<StripeCheckoutGateway['createCheckoutSession']>[0]
    options?: Parameters<StripeCheckoutGateway['createCheckoutSession']>[1]
  }[] = []
  readonly expiredSessions: string[] = []
  readonly retrievedSessions: string[] = []
  private nextSession: CreatedCheckoutSession = {
    id: 'cs_test_e2e_success',
    object: 'checkout.session',
    url: 'https://checkout.stripe.test/e2e',
  } as CreatedCheckoutSession
  private nextError: Error | null = null
  private nextExpirationError: Error | null = null
  private nextExpirationResult: ExpireCheckoutSessionResult | null = null
  private nextRetrieveResult: CheckoutSessionStateResult | null = null
  private nextExpirationBarrier: {
    started: Promise<void>
    released: Promise<ExpireCheckoutSessionResult>
    release: (result: ExpireCheckoutSessionResult) => void
  } | null = null
  private resolveNextExpirationStarted: (() => void) | null = null

  reset() {
    this.createdSessions.length = 0
    this.expiredSessions.length = 0
    this.retrievedSessions.length = 0
    this.nextError = null
    this.nextExpirationError = null
    this.nextExpirationResult = null
    this.nextRetrieveResult = null
    this.nextExpirationBarrier = null
    this.resolveNextExpirationStarted = null
    this.nextSession = {
      id: 'cs_test_e2e_success',
      object: 'checkout.session',
      url: 'https://checkout.stripe.test/e2e',
    } as CreatedCheckoutSession
  }

  setNextSession(session: Pick<CreatedCheckoutSession, 'id' | 'url'>) {
    this.nextSession = {
      id: session.id,
      object: 'checkout.session',
      url: session.url,
    } as CreatedCheckoutSession
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

  setNextRetrieveResult(result: CheckoutSessionStateResult) {
    this.nextRetrieveResult = result
  }

  pauseNextExpiration() {
    let resolveStarted: () => void = () => {}
    let release: (result: ExpireCheckoutSessionResult) => void = () => {}
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve
    })
    const released = new Promise<ExpireCheckoutSessionResult>((resolve) => {
      release = resolve
    })

    this.resolveNextExpirationStarted = resolveStarted
    this.nextExpirationBarrier = {
      started,
      released,
      release: (result) => {
        release(result)
        this.nextExpirationResult = null
      },
    }
    const barrier = this.nextExpirationBarrier

    return {
      started,
      release: (result: ExpireCheckoutSessionResult) => {
        barrier.release(result)
      },
    }
  }

  createCheckoutSession(
    params: Parameters<StripeCheckoutGateway['createCheckoutSession']>[0],
    options?: Parameters<StripeCheckoutGateway['createCheckoutSession']>[1],
  ): Promise<CreatedCheckoutSession> {
    this.createdSessions.push({ params, options })

    if (this.nextError) {
      const error = this.nextError
      this.nextError = null
      return Promise.reject(error)
    }

    return Promise.resolve(this.nextSession)
  }

  retrieveCheckoutSession(
    sessionId: string,
  ): Promise<CheckoutSessionStateResult> {
    this.retrievedSessions.push(sessionId)

    if (this.nextRetrieveResult) {
      const result = this.nextRetrieveResult
      this.nextRetrieveResult = null
      return Promise.resolve(result)
    }

    return Promise.resolve({
      status: 'open_unpaid',
    } satisfies CheckoutSessionStateResult)
  }

  async expireCheckoutSession(
    sessionId: string,
  ): Promise<ExpireCheckoutSessionResult> {
    this.expiredSessions.push(sessionId)
    this.resolveNextExpirationStarted?.()
    this.resolveNextExpirationStarted = null

    if (this.nextExpirationBarrier) {
      const barrier = this.nextExpirationBarrier
      this.nextExpirationBarrier = null
      return barrier.released
    }

    if (this.nextExpirationError) {
      const error = this.nextExpirationError
      this.nextExpirationError = null
      return {
        status: 'failed',
        retryable: true,
        reason: error.message,
      } satisfies ExpireCheckoutSessionResult
    }

    if (this.nextExpirationResult) {
      const result = this.nextExpirationResult
      this.nextExpirationResult = null
      return result
    }

    return {
      status: 'expired',
    } satisfies ExpireCheckoutSessionResult
  }

  constructWebhookEvent(
    rawBody: Buffer,
    signature: string,
    webhookSecret: string,
  ): Stripe.Event {
    const stripe = new Stripe('sk_test_localco_e2e')

    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  }
}
