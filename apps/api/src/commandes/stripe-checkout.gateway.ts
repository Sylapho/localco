import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Stripe from 'stripe'

type StripeClient = InstanceType<typeof Stripe>
type CreateCheckoutSessionArgs = Parameters<
  StripeClient['checkout']['sessions']['create']
>
type RetrievedCheckoutSession = Awaited<
  ReturnType<StripeClient['checkout']['sessions']['retrieve']>
>

export type CheckoutSessionStateResult =
  | {
      status: 'open_unpaid'
    }
  | {
      status: 'already_expired'
    }
  | {
      status: 'already_paid'
      paymentIntentId?: string
    }
  | {
      status: 'not_found'
    }
  | {
      status: 'failed'
      retryable: boolean
      reason: string
    }

export type CheckoutSessionExpirationResult =
  | {
      status: 'expired'
    }
  | {
      status: 'already_expired'
    }
  | {
      status: 'already_paid'
      paymentIntentId?: string
    }
  | {
      status: 'not_found'
    }
  | {
      status: 'failed'
      retryable: boolean
      reason: string
    }

export type ExpireCheckoutSessionResult = CheckoutSessionExpirationResult

export class ExpireCheckoutSessionError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'ExpireCheckoutSessionError'
  }
}

@Injectable()
export class StripeCheckoutGateway {
  private stripe: InstanceType<typeof Stripe> | null = null

  constructor(private readonly configService: ConfigService) {}

  createCheckoutSession(
    params: CreateCheckoutSessionArgs[0],
    options?: CreateCheckoutSessionArgs[1],
  ) {
    return this.getStripe().checkout.sessions.create(params, options)
  }

  async retrieveCheckoutSession(
    sessionId: string,
  ): Promise<CheckoutSessionStateResult> {
    try {
      const session =
        await this.getStripe().checkout.sessions.retrieve(sessionId)

      return this.getCheckoutSessionState(session)
    } catch (error) {
      const stripeError = this.normalizeStripeError(error)

      if (stripeError.code === 'resource_missing') {
        return { status: 'not_found' }
      }

      return {
        status: 'failed',
        retryable: this.isRetryableStripeError(error),
        reason: stripeError.message,
      }
    }
  }

  async expireCheckoutSession(
    sessionId: string,
  ): Promise<CheckoutSessionExpirationResult> {
    const currentState = await this.retrieveCheckoutSession(sessionId)

    if (currentState.status === 'already_paid') {
      return currentState
    }

    if (currentState.status === 'already_expired') {
      return currentState
    }

    if (currentState.status === 'not_found') {
      return currentState
    }

    if (currentState.status === 'failed') {
      return currentState
    }

    try {
      const session = await this.getStripe().checkout.sessions.expire(sessionId)
      const expiredState = this.getCheckoutSessionState(session)

      if (expiredState.status === 'already_expired') {
        return { status: 'expired' }
      }

      if (expiredState.status === 'already_paid') {
        return expiredState
      }

      return {
        status: 'failed',
        retryable: true,
        reason: `Unexpected checkout session status after expiration: ${session.status ?? 'missing'}`,
      }
    } catch (error) {
      const stripeError = this.normalizeStripeError(error)

      if (stripeError.code === 'resource_missing') {
        return { status: 'not_found' }
      }

      const message = stripeError.message.toLowerCase()

      if (message.includes('expired')) {
        return { status: 'already_expired' }
      }

      if (
        message.includes('complete') ||
        message.includes('completed') ||
        message.includes('paid')
      ) {
        return { status: 'already_paid' }
      }

      return {
        status: 'failed',
        retryable: this.isRetryableStripeError(error),
        reason: stripeError.message,
      }
    }
  }

  constructWebhookEvent(
    rawBody: Buffer,
    signature: string,
    webhookSecret: string,
  ) {
    return this.getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    )
  }

  private getStripe() {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY')

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is missing')
    }

    if (!this.stripe) {
      this.stripe = new Stripe(secretKey)
    }

    return this.stripe
  }

  private getCheckoutSessionState(
    session: RetrievedCheckoutSession,
  ): CheckoutSessionStateResult {
    if (
      session.payment_status === 'paid' ||
      session.payment_status === 'no_payment_required' ||
      session.status === 'complete'
    ) {
      return {
        status: 'already_paid',
        paymentIntentId: this.getPaymentIntentId(session),
      }
    }

    if (session.status === 'expired') {
      return { status: 'already_expired' }
    }

    if (session.status === 'open') {
      return { status: 'open_unpaid' }
    }

    return {
      status: 'failed',
      retryable: true,
      reason: `Unexpected checkout session status: ${session.status ?? 'missing'}`,
    }
  }

  private getPaymentIntentId(session: RetrievedCheckoutSession) {
    const paymentIntent = session.payment_intent

    if (!paymentIntent) {
      return undefined
    }

    if (typeof paymentIntent === 'string') {
      return paymentIntent
    }

    return paymentIntent.id
  }

  private isRetryableStripeError(error: unknown) {
    if (typeof error !== 'object' || error === null) {
      return true
    }

    const code =
      'code' in error && typeof error.code === 'string' ? error.code : undefined
    const type =
      'type' in error && typeof error.type === 'string' ? error.type : undefined
    const statusCode =
      'statusCode' in error && typeof error.statusCode === 'number'
        ? error.statusCode
        : undefined

    if (
      type === 'StripeAPIError' ||
      type === 'StripeConnectionError' ||
      type === 'StripeRateLimitError'
    ) {
      return true
    }

    if (code === 'lock_timeout' || code === 'rate_limit') {
      return true
    }

    if (statusCode && (statusCode === 409 || statusCode === 429)) {
      return true
    }

    if (statusCode && statusCode >= 500) {
      return true
    }

    return false
  }

  private normalizeStripeError(error: unknown) {
    if (error instanceof Error) {
      const code =
        'code' in error && typeof error.code === 'string'
          ? error.code
          : undefined

      return {
        message: error.message,
        code,
      }
    }

    return {
      message: 'Unknown Stripe checkout session expiration error',
      code: undefined,
    }
  }
}
