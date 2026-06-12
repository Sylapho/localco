const mockPoolEnd = jest.fn()
const mockPrismaPg = jest.fn()
const mockConnect = jest.fn()
const mockDisconnect = jest.fn()

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation((options) => ({
    options,
    end: mockPoolEnd,
  })),
}))

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation((pool) => {
    mockPrismaPg(pool)
    return {
      pool,
    }
  }),
}))

jest.mock('../../prisma/generated/prisma/client', () => ({
  PrismaClient: class {
    $connect = mockConnect
    $disconnect = mockDisconnect

    constructor(readonly options: unknown) {}
  },
}))

import { Pool } from 'pg'
import { PrismaService } from './prisma.service'

describe('PrismaService', () => {
  const previousDatabaseUrl = process.env.DATABASE_URL

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.DATABASE_URL = 'postgresql://localco:test@localhost:5432/test'
  })

  afterAll(() => {
    process.env.DATABASE_URL = previousDatabaseUrl
  })

  it('creates a Prisma client with a PostgreSQL adapter', () => {
    const service = new PrismaService()

    expect(Pool).toHaveBeenCalledWith({
      connectionString: 'postgresql://localco:test@localhost:5432/test',
    })
    expect(mockPrismaPg).toHaveBeenCalledWith(
      expect.objectContaining({
        end: mockPoolEnd,
      }),
    )
    expect(service).toBeInstanceOf(PrismaService)
  })

  it('connects and disconnects the Prisma client lifecycle', async () => {
    const service = new PrismaService()

    await service.onModuleInit()
    await service.onModuleDestroy()

    expect(mockConnect).toHaveBeenCalled()
    expect(mockDisconnect).toHaveBeenCalled()
    expect(mockPoolEnd).toHaveBeenCalled()
  })

  it('throws when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL

    expect(() => new PrismaService()).toThrow(/DATABASE_URL est manquante/)
  })
})
