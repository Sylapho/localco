import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Stripe from 'stripe'

type StripeClient = InstanceType<typeof Stripe>
type CreateCheckoutSessionArgs = Parameters<
  StripeClient['checkout']['sessions']['create']
>

export type ExpireCheckoutSessionResult =
  | {
      expired: true
      alreadyFinal: false
    }
  | {
      expired: false
      alreadyFinal: true
      reason: 'already_expired' | 'already_completed' | 'not_found'
    }

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

  async expireCheckoutSession(
    sessionId: string,
  ): Promise<ExpireCheckoutSessionResult> {
    try {
      await this.getStripe().checkout.sessions.expire(sessionId)

      return { expired: true, alreadyFinal: false }
    } catch (error) {
      const stripeError = this.normalizeStripeError(error)

      if (stripeError.code === 'resource_missing') {
        return {
          expired: false,
          alreadyFinal: true,
          reason: 'not_found',
        }
      }

      const message = stripeError.message.toLowerCase()

      if (message.includes('expired')) {
        return {
          expired: false,
          alreadyFinal: true,
          reason: 'already_expired',
        }
      }

      if (
        message.includes('complete') ||
        message.includes('completed') ||
        message.includes('paid')
      ) {
        return {
          expired: false,
          alreadyFinal: true,
          reason: 'already_completed',
        }
      }

      throw new ExpireCheckoutSessionError(
        stripeError.message,
        stripeError.code,
      )
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
