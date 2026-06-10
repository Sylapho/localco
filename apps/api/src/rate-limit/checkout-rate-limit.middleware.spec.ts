import type { NextFunction, Request, Response } from 'express'
import {
  createCheckoutRateLimitMiddleware,
  getCheckoutRateLimitOptionsFromEnv,
} from './checkout-rate-limit.middleware'

function createRequest(ip = '127.0.0.1') {
  return {
    ip,
    socket: {
      remoteAddress: ip,
    },
  } as Request
}

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response & {
    status: jest.Mock
    json: jest.Mock
  }
}

describe('createCheckoutRateLimitMiddleware', () => {
  it('should allow requests until the configured maximum is reached', () => {
    let currentTime = 1_000
    const middleware = createCheckoutRateLimitMiddleware({
      windowMs: 60_000,
      maxRequests: 2,
      now: () => currentTime,
    })
    const next = jest.fn() as NextFunction
    const response = createResponse()

    middleware(createRequest(), response, next)
    middleware(createRequest(), response, next)
    middleware(createRequest(), response, next)

    expect(next).toHaveBeenCalledTimes(2)
    expect(response.status).toHaveBeenCalledWith(429)
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 429,
      message: 'Trop de tentatives de paiement, veuillez reessayer bientot',
      error: 'Too Many Requests',
    })

    currentTime += 60_001
    middleware(createRequest(), response, next)

    expect(next).toHaveBeenCalledTimes(3)
  })

  it('should rate limit each IP independently', () => {
    const middleware = createCheckoutRateLimitMiddleware({
      windowMs: 60_000,
      maxRequests: 1,
      now: () => 1_000,
    })
    const next = jest.fn() as NextFunction
    const response = createResponse()

    middleware(createRequest('127.0.0.1'), response, next)
    middleware(createRequest('127.0.0.2'), response, next)
    middleware(createRequest('127.0.0.1'), response, next)

    expect(next).toHaveBeenCalledTimes(2)
    expect(response.status).toHaveBeenCalledTimes(1)
  })
})

describe('getCheckoutRateLimitOptionsFromEnv', () => {
  it('should read valid checkout rate limit values from env', () => {
    expect(
      getCheckoutRateLimitOptionsFromEnv({
        CHECKOUT_RATE_LIMIT_WINDOW_MS: '120000',
        CHECKOUT_RATE_LIMIT_MAX: '5',
      }),
    ).toEqual({
      windowMs: 120_000,
      maxRequests: 5,
    })
  })

  it('should fall back when env values are invalid', () => {
    expect(
      getCheckoutRateLimitOptionsFromEnv({
        CHECKOUT_RATE_LIMIT_WINDOW_MS: 'invalid',
        CHECKOUT_RATE_LIMIT_MAX: '0',
      }),
    ).toEqual({
      windowMs: 60_000,
      maxRequests: 10,
    })
  })
})
