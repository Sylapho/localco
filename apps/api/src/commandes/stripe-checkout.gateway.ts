import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Stripe from 'stripe'

type StripeClient = InstanceType<typeof Stripe>
type CreateCheckoutSessionArgs = Parameters<
  StripeClient['checkout']['sessions']['create']
>

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
}
