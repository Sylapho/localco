import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { PrismaService } from './prisma/prisma.service'

describe('AppController', () => {
  let appController: AppController
  const prismaServiceMock = {
    isDatabaseAvailable: jest.fn(),
  }
  const configServiceMock = {
    get: jest.fn(),
  }

  beforeEach(async () => {
    prismaServiceMock.isDatabaseAvailable.mockResolvedValue(true)
    configServiceMock.get.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        DATABASE_URL: 'postgresql://localco:test@localhost:5432/test',
        STRIPE_SECRET_KEY: 'sk_test_localco',
        RESEND_API_KEY: 're_test',
      }

      return values[key]
    })

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile()

    appController = app.get(AppController)
  })

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!')
    })
  })

  describe('health', () => {
    it('should return API health status', () => {
      const health = appController.getHealth()

      expect(health).toEqual(
        expect.objectContaining({
          status: 'ok',
          service: 'localco-api',
        }),
      )

      expect(typeof health.timestamp).toBe('string')
      expect(typeof health.uptime).toBe('number')
    })
  })

  describe('readiness', () => {
    it('should return API readiness status', async () => {
      const response = { status: jest.fn() }
      const readiness = await appController.getReadiness(response as never)

      expect(readiness).toEqual(
        expect.objectContaining({
          status: 'ready',
          service: 'localco-api',
          checks: {
            database: {
              status: 'up',
            },
            stripe: {
              configured: true,
            },
            resend: {
              configured: true,
            },
          },
        }),
      )
      expect(response.status).not.toHaveBeenCalled()
      expect(typeof readiness.timestamp).toBe('string')
    })

    it('should mark readiness as unavailable when a check fails', async () => {
      prismaServiceMock.isDatabaseAvailable.mockResolvedValue(false)
      configServiceMock.get.mockImplementation((key: string) => {
        if (key === 'DATABASE_URL') return 'postgresql://localco:test'
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_localco'
        return undefined
      })
      const response = { status: jest.fn() }

      const readiness = await appController.getReadiness(response as never)

      expect(readiness).toEqual(
        expect.objectContaining({
          status: 'not_ready',
          checks: {
            database: {
              status: 'down',
            },
            stripe: {
              configured: true,
            },
            resend: {
              configured: false,
            },
          },
        }),
      )
      expect(response.status).toHaveBeenCalledWith(503)
    })
  })
})
