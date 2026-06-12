import Stripe from 'stripe'
import {
  ExpireCheckoutSessionError,
  StripeCheckoutGateway,
} from './stripe-checkout.gateway'

const mockStripeCheckoutSessionsCreate = jest.fn()
const mockStripeCheckoutSessionsRetrieve = jest.fn()
const mockStripeCheckoutSessionsExpire = jest.fn()
const mockStripeConstructEvent = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockStripeCheckoutSessionsCreate,
        retrieve: mockStripeCheckoutSessionsRetrieve,
        expire: mockStripeCheckoutSessionsExpire,
      },
    },
    webhooks: {
      constructEvent: mockStripeConstructEvent,
    },
  }))
})

describe('StripeCheckoutGateway', () => {
  const configServiceMock = {
    get: jest.fn(),
  }

  let gateway: StripeCheckoutGateway

  beforeEach(() => {
    jest.clearAllMocks()
    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'STRIPE_SECRET_KEY') {
        return 'sk_test_localco'
      }

      return undefined
    })
    gateway = new StripeCheckoutGateway(configServiceMock as never)
  })

  it('creates a checkout session with the configured Stripe client', async () => {
    const stripeSession = {
      id: 'cs_created',
      url: 'https://checkout.stripe.test/cs_created',
    }
    mockStripeCheckoutSessionsCreate.mockResolvedValueOnce(stripeSession)

    await expect(
      gateway.createCheckoutSession(
        {
          mode: 'payment',
          line_items: [],
          success_url: 'https://shop.test/success',
          cancel_url: 'https://shop.test/cancel',
        },
        {
          idempotencyKey: 'checkout:test',
        },
      ),
    ).resolves.toBe(stripeSession)

    expect(Stripe).toHaveBeenCalledWith('sk_test_localco')
    expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
      {
        mode: 'payment',
        line_items: [],
        success_url: 'https://shop.test/success',
        cancel_url: 'https://shop.test/cancel',
      },
      {
        idempotencyKey: 'checkout:test',
      },
    )
  })

  it.each([
    [
      'open unpaid',
      {
        id: 'cs_open',
        status: 'open',
        payment_status: 'unpaid',
      },
      {
        status: 'open_unpaid',
      },
    ],
    [
      'expired',
      {
        id: 'cs_expired',
        status: 'expired',
        payment_status: 'unpaid',
      },
      {
        status: 'already_expired',
      },
    ],
    [
      'paid with string payment intent',
      {
        id: 'cs_paid',
        status: 'complete',
        payment_status: 'paid',
        payment_intent: 'pi_paid',
      },
      {
        status: 'already_paid',
        paymentIntentId: 'pi_paid',
      },
    ],
    [
      'paid with expanded payment intent',
      {
        id: 'cs_paid_expanded',
        status: 'open',
        payment_status: 'no_payment_required',
        payment_intent: {
          id: 'pi_expanded',
        },
      },
      {
        status: 'already_paid',
        paymentIntentId: 'pi_expanded',
      },
    ],
    [
      'unexpected session status',
      {
        id: 'cs_unexpected',
        status: null,
        payment_status: 'unpaid',
      },
      {
        status: 'failed',
        retryable: true,
        reason: 'Unexpected checkout session status: missing',
      },
    ],
  ])(
    'retrieves a checkout session state for %s',
    async (_label, session, result) => {
      mockStripeCheckoutSessionsRetrieve.mockResolvedValueOnce(session)

      await expect(
        gateway.retrieveCheckoutSession(session.id),
      ).resolves.toEqual(result)
    },
  )

  it.each([
    [
      'missing resource',
      Object.assign(new Error('No such checkout.session'), {
        code: 'resource_missing',
      }),
      {
        status: 'not_found',
      },
    ],
    [
      'retryable API failure',
      Object.assign(new Error('Stripe unavailable'), {
        type: 'StripeAPIError',
        statusCode: 500,
      }),
      {
        status: 'failed',
        retryable: true,
        reason: 'Stripe unavailable',
      },
    ],
    [
      'non retryable validation failure',
      Object.assign(new Error('Bad request'), {
        type: 'StripeInvalidRequestError',
        statusCode: 400,
      }),
      {
        status: 'failed',
        retryable: false,
        reason: 'Bad request',
      },
    ],
    [
      'conflict status code',
      Object.assign(new Error('Conflict'), {
        type: 'StripeInvalidRequestError',
        statusCode: 409,
      }),
      {
        status: 'failed',
        retryable: true,
        reason: 'Conflict',
      },
    ],
    [
      'server status code',
      Object.assign(new Error('Server error'), {
        type: 'StripeInvalidRequestError',
        statusCode: 503,
      }),
      {
        status: 'failed',
        retryable: true,
        reason: 'Server error',
      },
    ],
    [
      'unknown thrown value',
      'boom',
      {
        status: 'failed',
        retryable: true,
        reason: 'Unknown Stripe checkout session expiration error',
      },
    ],
  ])('normalizes retrieve failures for %s', async (_label, error, result) => {
    mockStripeCheckoutSessionsRetrieve.mockRejectedValueOnce(error)

    await expect(gateway.retrieveCheckoutSession('cs_error')).resolves.toEqual(
      result,
    )
  })

  it.each([
    [
      'already paid',
      {
        id: 'cs_paid',
        status: 'complete',
        payment_status: 'paid',
      },
      {
        status: 'already_paid',
      },
    ],
    [
      'already expired',
      {
        id: 'cs_expired',
        status: 'expired',
        payment_status: 'unpaid',
      },
      {
        status: 'already_expired',
      },
    ],
  ])(
    'does not call Stripe expire when retrieve returns %s',
    async (_label, session, result) => {
      mockStripeCheckoutSessionsRetrieve.mockResolvedValueOnce(session)

      await expect(gateway.expireCheckoutSession(session.id)).resolves.toEqual(
        result,
      )

      expect(mockStripeCheckoutSessionsExpire).not.toHaveBeenCalled()
    },
  )

  it.each([
    [
      'not found',
      Object.assign(new Error('No such checkout.session'), {
        code: 'resource_missing',
      }),
      {
        status: 'not_found',
      },
    ],
    [
      'failed',
      Object.assign(new Error('Bad request'), {
        type: 'StripeInvalidRequestError',
        statusCode: 400,
      }),
      {
        status: 'failed',
        retryable: false,
        reason: 'Bad request',
      },
    ],
  ])(
    'does not call Stripe expire when retrieve returns %s',
    async (_label, error, result) => {
      mockStripeCheckoutSessionsRetrieve.mockRejectedValueOnce(error)

      await expect(
        gateway.expireCheckoutSession('cs_blocked'),
      ).resolves.toEqual(result)

      expect(mockStripeCheckoutSessionsExpire).not.toHaveBeenCalled()
    },
  )

  it('expires an open checkout session', async () => {
    mockStripeCheckoutSessionsRetrieve.mockResolvedValueOnce({
      id: 'cs_open',
      status: 'open',
      payment_status: 'unpaid',
    })
    mockStripeCheckoutSessionsExpire.mockResolvedValueOnce({
      id: 'cs_open',
      status: 'expired',
      payment_status: 'unpaid',
    })

    await expect(gateway.expireCheckoutSession('cs_open')).resolves.toEqual({
      status: 'expired',
    })
  })

  it('reports paid session if expiration races with payment', async () => {
    mockStripeCheckoutSessionsRetrieve.mockResolvedValueOnce({
      id: 'cs_race',
      status: 'open',
      payment_status: 'unpaid',
    })
    mockStripeCheckoutSessionsExpire.mockResolvedValueOnce({
      id: 'cs_race',
      status: 'complete',
      payment_status: 'paid',
      payment_intent: 'pi_race',
    })

    await expect(gateway.expireCheckoutSession('cs_race')).resolves.toEqual({
      status: 'already_paid',
      paymentIntentId: 'pi_race',
    })
  })

  it('reports failed if expiration returns an unexpected state', async () => {
    mockStripeCheckoutSessionsRetrieve.mockResolvedValueOnce({
      id: 'cs_open',
      status: 'open',
      payment_status: 'unpaid',
    })
    mockStripeCheckoutSessionsExpire.mockResolvedValueOnce({
      id: 'cs_open',
      status: 'open',
      payment_status: 'unpaid',
    })

    await expect(gateway.expireCheckoutSession('cs_open')).resolves.toEqual({
      status: 'failed',
      retryable: true,
      reason: 'Unexpected checkout session status after expiration: open',
    })
  })

  it.each([
    [
      Object.assign(new Error('Session already expired'), {
        code: 'checkout_session_invalid_state',
      }),
      {
        status: 'already_expired',
      },
    ],
    [
      Object.assign(new Error('Session is completed'), {
        code: 'checkout_session_invalid_state',
      }),
      {
        status: 'already_paid',
      },
    ],
    [
      Object.assign(new Error('No such checkout.session'), {
        code: 'resource_missing',
      }),
      {
        status: 'not_found',
      },
    ],
    [
      Object.assign(new Error('Rate limited'), {
        code: 'rate_limit',
        statusCode: 429,
      }),
      {
        status: 'failed',
        retryable: true,
        reason: 'Rate limited',
      },
    ],
  ])('normalizes expiration errors', async (error, result) => {
    mockStripeCheckoutSessionsRetrieve.mockResolvedValueOnce({
      id: 'cs_open',
      status: 'open',
      payment_status: 'unpaid',
    })
    mockStripeCheckoutSessionsExpire.mockRejectedValueOnce(error)

    await expect(gateway.expireCheckoutSession('cs_open')).resolves.toEqual(
      result,
    )
  })

  it('constructs a webhook event with Stripe', () => {
    const event = {
      id: 'evt_test',
      type: 'checkout.session.completed',
    }
    mockStripeConstructEvent.mockReturnValueOnce(event)

    expect(
      gateway.constructWebhookEvent(
        Buffer.from('{}'),
        'stripe-signature',
        'whsec_test',
      ),
    ).toBe(event)
    expect(mockStripeConstructEvent).toHaveBeenCalledWith(
      Buffer.from('{}'),
      'stripe-signature',
      'whsec_test',
    )
  })

  it('throws when STRIPE_SECRET_KEY is missing', async () => {
    configServiceMock.get.mockReturnValueOnce(undefined)
    gateway = new StripeCheckoutGateway(configServiceMock as never)

    await expect(
      gateway.retrieveCheckoutSession('cs_missing_key'),
    ).resolves.toEqual({
      status: 'failed',
      retryable: false,
      reason: 'STRIPE_SECRET_KEY is missing',
    })
  })

  it('throws synchronously when creating a session without STRIPE_SECRET_KEY', () => {
    configServiceMock.get.mockReturnValueOnce(undefined)
    gateway = new StripeCheckoutGateway(configServiceMock as never)

    expect(() =>
      gateway.createCheckoutSession({
        mode: 'payment',
        line_items: [],
        success_url: 'https://shop.test/success',
        cancel_url: 'https://shop.test/cancel',
      }),
    ).toThrow('STRIPE_SECRET_KEY is missing')
  })

  it('keeps the legacy expiration error shape available', () => {
    const error = new ExpireCheckoutSessionError('Stripe timeout', 'api_error')

    expect(error).toMatchObject({
      name: 'ExpireCheckoutSessionError',
      message: 'Stripe timeout',
      code: 'api_error',
    })
  })
})
