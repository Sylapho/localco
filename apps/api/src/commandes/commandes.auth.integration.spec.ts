import { INestApplication, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { BetterAuthGuard } from '../auth/better-auth.guard'
import { ROLES } from '../auth/roles'
import { RolesGuard } from '../auth/roles.guard'
import { CommandesController } from './commandes.controller'
import { CommandesService } from './commandes.service'

const mockBetterAuthGetSession = jest.fn()

describe('Commandes admin auth integration', () => {
  let app: INestApplication

  const commandesServiceMock = {
    createCheckout: jest.fn(),
    handleStripeWebhook: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    cleanupAbandonedCommandes: jest.fn(),
    findOne: jest.fn(),
    updateStatut: jest.fn(),
  }

  const configServiceMock = {
    get: jest.fn(),
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    configServiceMock.get.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        DATABASE_URL:
          'postgresql://localco:localco@localhost:5432/localco_test',
      }

      return values[key]
    })

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CommandesController],
      providers: [
        BetterAuthGuard,
        RolesGuard,
        Reflector,
        {
          provide: CommandesService,
          useValue: commandesServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile()

    Object.assign(moduleFixture.get(BetterAuthGuard), {
      auth: {
        api: {
          getSession: mockBetterAuthGetSession,
        },
      },
    })

    app = moduleFixture.createNestApplication()

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )

    app.setGlobalPrefix('api')

    await app.init()
  })

  afterEach(async () => {
    if (app) {
      await app.close()
    }
  })

  it('GET /api/commandes should reject request without session cookie', async () => {
    await request(app.getHttpServer()).get('/api/commandes').expect(401)

    expect(mockBetterAuthGetSession).not.toHaveBeenCalled()
    expect(commandesServiceMock.findAll).not.toHaveBeenCalled()
  })

  it('GET /api/commandes should reject invalid session', async () => {
    mockBetterAuthGetSession.mockResolvedValueOnce(null)

    await request(app.getHttpServer())
      .get('/api/commandes')
      .set('Cookie', 'better-auth.session_token=invalid')
      .expect(401)

    const getSessionCalls = mockBetterAuthGetSession.mock.calls as Array<
      [{ headers?: unknown }]
    >
    const sessionRequest = getSessionCalls[0]?.[0]

    expect(sessionRequest?.headers).toBeInstanceOf(Headers)
    expect(commandesServiceMock.findAll).not.toHaveBeenCalled()
  })

  it('GET /api/commandes should reject authenticated user with insufficient role', async () => {
    mockBetterAuthGetSession.mockResolvedValueOnce({
      user: {
        id: 'user-stock',
        role: ROLES.STOCK,
      },
    })

    await request(app.getHttpServer())
      .get('/api/commandes')
      .set('Cookie', 'better-auth.session_token=valid')
      .expect(403)

    expect(commandesServiceMock.findAll).not.toHaveBeenCalled()
  })

  it.each([ROLES.GERANT, ROLES.VENDEUR, ROLES.PRODUCTION, ROLES.COMPTABLE])(
    'GET /api/commandes should allow role %s',
    async (role) => {
      const commandes = [
        {
          id: 1,
          statut: 'nouvelle',
          lignes: [],
        },
      ]

      mockBetterAuthGetSession.mockResolvedValueOnce({
        user: {
          id: `user-${role}`,
          role,
        },
      })

      commandesServiceMock.findAll.mockResolvedValueOnce(commandes)

      const response = await request(app.getHttpServer())
        .get('/api/commandes')
        .set('Cookie', 'better-auth.session_token=valid')
        .expect(200)

      expect(response.body).toEqual(commandes)
      expect(commandesServiceMock.findAll).toHaveBeenCalledTimes(1)
    },
  )

  it('GET /api/commandes/:id should parse id and return order for allowed role', async () => {
    const commande = {
      id: 42,
      statut: 'nouvelle',
      lignes: [],
    }

    mockBetterAuthGetSession.mockResolvedValueOnce({
      user: {
        id: 'user-comptable',
        role: ROLES.COMPTABLE,
      },
    })

    commandesServiceMock.findOne.mockResolvedValueOnce(commande)

    const response = await request(app.getHttpServer())
      .get('/api/commandes/42')
      .set('Cookie', 'better-auth.session_token=valid')
      .expect(200)

    expect(response.body).toEqual(commande)
    expect(commandesServiceMock.findOne).toHaveBeenCalledWith(42)
  })

  it('GET /api/commandes/:id should reject invalid id before calling service', async () => {
    mockBetterAuthGetSession.mockResolvedValueOnce({
      user: {
        id: 'user-gerant',
        role: ROLES.GERANT,
      },
    })

    await request(app.getHttpServer())
      .get('/api/commandes/not-a-number')
      .set('Cookie', 'better-auth.session_token=valid')
      .expect(400)

    expect(commandesServiceMock.findOne).not.toHaveBeenCalled()
  })

  it('PATCH /api/commandes/:id/statut should allow gerant to update status', async () => {
    const updated = {
      id: 12,
      statut: 'preparee',
      lignes: [],
    }

    mockBetterAuthGetSession.mockResolvedValueOnce({
      user: {
        id: 'user-gerant',
        role: ROLES.GERANT,
      },
    })

    commandesServiceMock.updateStatut.mockResolvedValueOnce(updated)

    const response = await request(app.getHttpServer())
      .patch('/api/commandes/12/statut')
      .set('Cookie', 'better-auth.session_token=valid')
      .send({
        statut: 'preparee',
      })
      .expect(200)

    expect(response.body).toEqual(updated)
    expect(commandesServiceMock.updateStatut).toHaveBeenCalledWith(
      12,
      'preparee',
    )
  })

  it.each([ROLES.GERANT, ROLES.VENDEUR, ROLES.PRODUCTION])(
    'PATCH /api/commandes/:id/statut should allow role %s',
    async (role) => {
      mockBetterAuthGetSession.mockResolvedValueOnce({
        user: {
          id: `user-${role}`,
          role,
        },
      })

      commandesServiceMock.updateStatut.mockResolvedValueOnce({
        id: 12,
        statut: 'preparee',
        lignes: [],
      })

      await request(app.getHttpServer())
        .patch('/api/commandes/12/statut')
        .set('Cookie', 'better-auth.session_token=valid')
        .send({
          statut: 'preparee',
        })
        .expect(200)

      expect(commandesServiceMock.updateStatut).toHaveBeenCalledWith(
        12,
        'preparee',
      )
    },
  )

  it('PATCH /api/commandes/:id/statut should reject comptable role', async () => {
    mockBetterAuthGetSession.mockResolvedValueOnce({
      user: {
        id: 'user-comptable',
        role: ROLES.COMPTABLE,
      },
    })

    await request(app.getHttpServer())
      .patch('/api/commandes/12/statut')
      .set('Cookie', 'better-auth.session_token=valid')
      .send({
        statut: 'preparee',
      })
      .expect(403)

    expect(commandesServiceMock.updateStatut).not.toHaveBeenCalled()
  })

  it('PATCH /api/commandes/:id/statut should reject invalid body before calling service', async () => {
    mockBetterAuthGetSession.mockResolvedValueOnce({
      user: {
        id: 'user-gerant',
        role: ROLES.GERANT,
      },
    })

    await request(app.getHttpServer())
      .patch('/api/commandes/12/statut')
      .set('Cookie', 'better-auth.session_token=valid')
      .send({
        statut: 'statut_inexistant',
      })
      .expect(400)

    expect(commandesServiceMock.updateStatut).not.toHaveBeenCalled()
  })

  it('POST /api/commandes/cleanup-abandoned should allow gerant only', async () => {
    mockBetterAuthGetSession.mockResolvedValueOnce({
      user: {
        id: 'user-gerant',
        role: ROLES.GERANT,
      },
    })

    commandesServiceMock.cleanupAbandonedCommandes.mockResolvedValueOnce({
      scanned: 3,
      cancelled: 2,
      skipped: 1,
      failed: 0,
    })

    const response = await request(app.getHttpServer())
      .post('/api/commandes/cleanup-abandoned')
      .set('Cookie', 'better-auth.session_token=valid')
      .expect(201)

    expect(response.body).toEqual({
      scanned: 3,
      cancelled: 2,
      skipped: 1,
      failed: 0,
    })
    expect(
      commandesServiceMock.cleanupAbandonedCommandes,
    ).toHaveBeenCalledTimes(1)
  })

  it.each([ROLES.VENDEUR, ROLES.PRODUCTION, ROLES.COMPTABLE, ROLES.STOCK])(
    'POST /api/commandes/cleanup-abandoned should reject role %s',
    async (role) => {
      mockBetterAuthGetSession.mockResolvedValueOnce({
        user: {
          id: `user-${role}`,
          role,
        },
      })

      await request(app.getHttpServer())
        .post('/api/commandes/cleanup-abandoned')
        .set('Cookie', 'better-auth.session_token=valid')
        .expect(403)

      expect(
        commandesServiceMock.cleanupAbandonedCommandes,
      ).not.toHaveBeenCalled()
    },
  )

  it('protected routes should default missing user role to vendeur', async () => {
    mockBetterAuthGetSession.mockResolvedValueOnce({
      user: {
        id: 'user-without-role',
      },
    })

    commandesServiceMock.findAll.mockResolvedValueOnce([])

    await request(app.getHttpServer())
      .get('/api/commandes')
      .set('Cookie', 'better-auth.session_token=valid')
      .expect(200)

    expect(commandesServiceMock.findAll).toHaveBeenCalledTimes(1)
  })
})
