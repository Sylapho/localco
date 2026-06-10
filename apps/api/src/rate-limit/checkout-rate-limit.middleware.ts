import { HttpStatus } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'

export type RateLimitEntry = {
  count: number
  resetAt: number
}

export type CheckoutRateLimitStore = {
  get(key: string): RateLimitEntry | undefined
  set(key: string, entry: RateLimitEntry): void
}

export type CheckoutRateLimitOptions = {
  windowMs?: number
  maxRequests?: number
  store?: CheckoutRateLimitStore
  now?: () => number
}

type CheckoutRateLimitConfig = {
  windowMs: number
  maxRequests: number
}

const DEFAULT_WINDOW_MS = 60_000
const DEFAULT_MAX_REQUESTS = 10

export class InMemoryCheckoutRateLimitStore implements CheckoutRateLimitStore {
  private readonly entries = new Map<string, RateLimitEntry>()

  get(key: string) {
    return this.entries.get(key)
  }

  set(key: string, entry: RateLimitEntry) {
    this.entries.set(key, entry)
  }
}

export function getCheckoutRateLimitOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): CheckoutRateLimitConfig {
  return {
    windowMs: parsePositiveInteger(
      env.CHECKOUT_RATE_LIMIT_WINDOW_MS,
      DEFAULT_WINDOW_MS,
    ),
    maxRequests: parsePositiveInteger(
      env.CHECKOUT_RATE_LIMIT_MAX,
      DEFAULT_MAX_REQUESTS,
    ),
  }
}

export function createCheckoutRateLimitMiddleware(
  options: CheckoutRateLimitOptions = {},
) {
  const envOptions = getCheckoutRateLimitOptionsFromEnv()
  const store = options.store ?? new InMemoryCheckoutRateLimitStore()
  const now = options.now ?? Date.now
  const windowMs = options.windowMs ?? envOptions.windowMs
  const maxRequests = options.maxRequests ?? envOptions.maxRequests

  return (request: Request, response: Response, next: NextFunction) => {
    const currentTime = now()
    const key = getRequestKey(request)
    const current = store.get(key)

    if (!current || current.resetAt <= currentTime) {
      store.set(key, {
        count: 1,
        resetAt: currentTime + windowMs,
      })
      next()
      return
    }

    if (current.count >= maxRequests) {
      response.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Trop de tentatives de paiement, veuillez reessayer bientot',
        error: 'Too Many Requests',
      })
      return
    }

    store.set(key, {
      ...current,
      count: current.count + 1,
    })
    next()
  }
}

function getRequestKey(request: Request) {
  return request.ip || request.socket.remoteAddress || 'unknown'
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
