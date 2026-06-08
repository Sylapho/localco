import { BadRequestException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../prisma/prisma.service'
import { CaisseService } from './caisse.service'

describe('CaisseService', () => {
  let service: CaisseService

  const prismaMock = {
    journeeCaisse: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    vente: {
      findMany: jest.fn(),
    },
  }

  beforeEach(async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-05-23T10:00:00.000Z'))

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaisseService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile()

    service = module.get<CaisseService>(CaisseService)
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('findClosedDays should return closed days ordered by date desc', async () => {
    const days = [
      {
        id: 2,
        date: new Date('2026-05-23T22:00:00.000Z'),
        totalTtcCents: 2000,
      },
      {
        id: 1,
        date: new Date('2026-05-22T22:00:00.000Z'),
        totalTtcCents: 1000,
      },
    ]

    prismaMock.journeeCaisse.findMany.mockResolvedValue(days)

    await expect(service.findClosedDays()).resolves.toEqual(days)
    expect(prismaMock.journeeCaisse.findMany).toHaveBeenCalledWith({
      orderBy: {
        date: 'desc',
      },
    })
  })

  it('getTodaySummary should return live totals when day is open', async () => {
    prismaMock.journeeCaisse.findUnique.mockResolvedValue(null)
    prismaMock.vente.findMany.mockResolvedValue([
      createVente({
        mode: 'cb',
        totalTtcCents: 1000,
        totalHtCents: 900,
        tvaCents: 100,
        lignes: [
          createLigneVente({
            quantite: 2,
            coutUnitaireMatiereCents: 150,
            quantiteMatiere: 1,
          }),
        ],
      }),
      createVente({
        mode: 'especes',
        totalTtcCents: 500,
        totalHtCents: 450,
        tvaCents: 50,
        lignes: [],
      }),
    ])

    await expect(service.getTodaySummary()).resolves.toMatchObject({
      dayKey: '2026-05-23',
      status: 'open',
      closedDay: null,
      totals: {
        totalTtcCents: 1500,
        totalHtCents: 1350,
        tvaCents: 150,
        especesCents: 500,
        cbCents: 1000,
        chequesCents: 0,
        margeCents: 1050,
        nbVentes: 2,
      },
    })
    expect(prismaMock.journeeCaisse.findUnique).toHaveBeenCalledWith({
      where: {
        date: new Date('2026-05-22T22:00:00.000Z'),
      },
    })
    expect(prismaMock.vente.findMany).toHaveBeenCalledWith({
      where: {
        date: {
          gte: new Date('2026-05-22T22:00:00.000Z'),
          lt: new Date('2026-05-23T22:00:00.000Z'),
        },
      },
      include: {
        lignes: {
          include: {
            article: {
              include: {
                nomen: {
                  include: {
                    mp: true,
                  },
                },
              },
            },
          },
        },
      },
    })
  })

  it('getTodaySummary should return closed snapshot when day is closed', async () => {
    const closedDay = {
      id: 1,
      date: new Date('2026-05-22T22:00:00.000Z'),
      totalTtcCents: 2000,
      totalHtCents: 1800,
      tvaCents: 200,
      especesCents: 500,
      cbCents: 1500,
      chequesCents: 0,
      margeCents: 1200,
      nbVentes: 3,
      clotureeA: new Date('2026-05-23T16:00:00.000Z'),
    }

    prismaMock.journeeCaisse.findUnique.mockResolvedValue(closedDay)
    prismaMock.vente.findMany.mockResolvedValue([])

    await expect(service.getTodaySummary()).resolves.toMatchObject({
      status: 'closed',
      closedDay,
      totals: {
        totalTtcCents: 2000,
        totalHtCents: 1800,
        tvaCents: 200,
        especesCents: 500,
        cbCents: 1500,
        chequesCents: 0,
        margeCents: 1200,
        nbVentes: 3,
      },
    })
  })

  it('closeToday should create a closed cash register day', async () => {
    const created = {
      id: 1,
      totalTtcCents: 3000,
    }

    prismaMock.journeeCaisse.findUnique.mockResolvedValue(null)
    prismaMock.vente.findMany.mockResolvedValue([
      createVente({
        mode: 'cheque',
        totalTtcCents: 3000,
        totalHtCents: 2700,
        tvaCents: 300,
        lignes: [
          createLigneVente({
            quantite: 3,
            coutUnitaireMatiereCents: 200,
            quantiteMatiere: 1,
          }),
        ],
      }),
    ])
    prismaMock.journeeCaisse.create.mockResolvedValue(created)

    await expect(service.closeToday()).resolves.toEqual(created)
    expect(prismaMock.journeeCaisse.create).toHaveBeenCalledWith({
      data: {
        date: new Date('2026-05-22T22:00:00.000Z'),
        totalTtcCents: 3000,
        totalHtCents: 2700,
        tvaCents: 300,
        especesCents: 0,
        cbCents: 0,
        chequesCents: 3000,
        margeCents: 2100,
        nbVentes: 1,
      },
    })
  })

  it('closeToday should reject an already closed day', async () => {
    prismaMock.journeeCaisse.findUnique.mockResolvedValue({
      id: 1,
    })

    await expect(service.closeToday()).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(prismaMock.vente.findMany).not.toHaveBeenCalled()
    expect(prismaMock.journeeCaisse.create).not.toHaveBeenCalled()
  })
})

function createVente(data: {
  mode: string
  totalTtcCents: number
  totalHtCents: number
  tvaCents: number
  lignes: ReturnType<typeof createLigneVente>[]
}) {
  return {
    id: 1,
    date: new Date('2026-05-23T10:30:00.000Z'),
    remiseCents: 0,
    userId: null,
    ...data,
  }
}

function createLigneVente(data: {
  quantite: number
  coutUnitaireMatiereCents: number
  quantiteMatiere: number
}) {
  return {
    id: 1,
    venteId: 1,
    articleId: 1,
    quantite: data.quantite,
    prixUnitCents: 500,
    tvaBps: 550,
    article: {
      id: 1,
      nom: 'Baguette',
      prixCents: 500,
      tvaBps: 550,
      stock: 10,
      online: true,
      emoji: '',
      description: null,
      createdAt: new Date('2026-05-23T08:00:00.000Z'),
      updatedAt: new Date('2026-05-23T08:00:00.000Z'),
      nomen: [
        {
          articleId: 1,
          mpId: 1,
          quantite: data.quantiteMatiere,
          mp: {
            id: 1,
            nom: 'Farine',
            stock: 10,
            unite: 'kg',
            coutUnitaireCents: data.coutUnitaireMatiereCents,
            seuil: 1,
            conditionnement: 'sac',
          },
        },
      ],
    },
  }
}
