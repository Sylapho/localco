import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { BetterAuthGuard } from './better-auth.guard'

type TestRequest = {
  headers: {
    cookie?: string
  }
  userId?: string
  userRole?: string
}

type GetSessionInput = {
  headers: Headers
}

describe('BetterAuthGuard', () => {
  const getSession = jest.fn()
  const configMock = {
    get: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    configMock.get.mockReturnValue(
      'postgresql://localco:localco_dev@localhost:5432/localco_db',
    )
  })

  function createContext(request: TestRequest): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext
  }

  function createGuard() {
    const guard = new BetterAuthGuard(configMock as unknown as ConfigService)

    ;(
      guard as unknown as {
        auth: {
          api: {
            getSession: typeof getSession
          }
        }
      }
    ).auth = {
      api: {
        getSession,
      },
    }

    return guard
  }

  it('should require a configured database url', () => {
    configMock.get.mockReturnValue(undefined)

    expect(
      () => new BetterAuthGuard(configMock as unknown as ConfigService),
    ).toThrow('DATABASE_URL est manquante')
  })

  it('should read the configured database url', () => {
    createGuard()

    expect(configMock.get).toHaveBeenCalledWith('DATABASE_URL')
  })

  it('should reject missing session cookie', async () => {
    const guard = createGuard()
    const request: TestRequest = {
      headers: {},
    }

    await expect(
      guard.canActivate(createContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException)
    expect(getSession).not.toHaveBeenCalled()
  })

  it('should attach user metadata to the request', async () => {
    const guard = createGuard()
    const request: TestRequest = {
      headers: {
        cookie: 'better-auth.session_token=session-token',
      },
    }

    getSession.mockResolvedValue({
      user: {
        id: 'user_123',
        role: 'gerant',
      },
    })

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true)

    const [getSessionInput] = getSession.mock.calls[0] as [GetSessionInput]
    expect(getSessionInput.headers).toBeInstanceOf(Headers)
    expect(getSessionInput.headers.get('cookie')).toBe(
      'better-auth.session_token=session-token',
    )
    expect(request.userId).toBe('user_123')
    expect(request.userRole).toBe('gerant')
  })

  it('should default role to vendeur when the session has no role', async () => {
    const guard = createGuard()
    const request: TestRequest = {
      headers: {
        cookie: 'better-auth.session_token=session-token',
      },
    }

    getSession.mockResolvedValue({
      user: {
        id: 'user_123',
      },
    })

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true)
    expect(request.userRole).toBe('vendeur')
  })

  it('should reject invalid sessions', async () => {
    const guard = createGuard()
    const request: TestRequest = {
      headers: {
        cookie: 'better-auth.session_token=invalid',
      },
    }

    getSession.mockResolvedValue(null)

    await expect(
      guard.canActivate(createContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
