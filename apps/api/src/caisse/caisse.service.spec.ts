import { BadRequestException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../prisma/prisma.service'
import { CaisseService } from './caisse.service'

describe('CaisseService', () => {
  let service: CaisseService

  const prismaMock = {
    journeeCaisse: {
      findUnique: jest.fn(),
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

  it('getTodaySummary should return live totals when day is open', async () => {
    prismaMock.journeeCaisse.findUnique.mockResolvedValue(null)
    prismaMock.vente.findMany.mockResolvedValue([
      createVente({
        mode: 'cb',
        totalTTC: 10,
        totalHT: 9,
        tva: 1,
        lignes: [
          createLigneVente({
            quantite: 2,
            coutUnitaireMatiere: 1.5,
            quantiteMatiere: 1,
          }),
        ],
      }),
      createVente({
        mode: 'especes',
        totalTTC: 5,
        totalHT: 4.5,
        tva: 0.5,
        lignes: [],
      }),
    ])

    await expect(service.getTodaySummary()).resolves.toMatchObject({
      dayKey: '2026-05-23',
      status: 'open',
      closedDay: null,
      totals: {
        totalTTC: 15,
        totalHT: 13.5,
        tva: 1.5,
        especes: 5,
        cb: 10,
        cheques: 0,
        marge: 10.5,
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
      totalTTC: 20,
      totalHT: 18,
      tva: 2,
      especes: 5,
      cb: 15,
      cheques: 0,
      marge: 12,
      nbVentes: 3,
      clotureeA: new Date('2026-05-23T16:00:00.000Z'),
    }

    prismaMock.journeeCaisse.findUnique.mockResolvedValue(closedDay)
    prismaMock.vente.findMany.mockResolvedValue([])

    await expect(service.getTodaySummary()).resolves.toMatchObject({
      status: 'closed',
      closedDay,
      totals: {
        totalTTC: 20,
        totalHT: 18,
        tva: 2,
        especes: 5,
        cb: 15,
        cheques: 0,
        marge: 12,
        nbVentes: 3,
      },
    })
  })

  it('closeToday should create a closed cash register day', async () => {
    const created = {
      id: 1,
      totalTTC: 30,
    }

    prismaMock.journeeCaisse.findUnique.mockResolvedValue(null)
    prismaMock.vente.findMany.mockResolvedValue([
      createVente({
        mode: 'cheque',
        totalTTC: 30,
        totalHT: 27,
        tva: 3,
        lignes: [
          createLigneVente({
            quantite: 3,
            coutUnitaireMatiere: 2,
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
        totalTTC: 30,
        totalHT: 27,
        tva: 3,
        especes: 0,
        cb: 0,
        cheques: 30,
        marge: 21,
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
  totalTTC: number
  totalHT: number
  tva: number
  lignes: ReturnType<typeof createLigneVente>[]
}) {
  return {
    id: 1,
    date: new Date('2026-05-23T10:30:00.000Z'),
    remise: 0,
    userId: null,
    ...data,
  }
}

function createLigneVente(data: {
  quantite: number
  coutUnitaireMatiere: number
  quantiteMatiere: number
}) {
  return {
    id: 1,
    venteId: 1,
    articleId: 1,
    quantite: data.quantite,
    prixUnit: 5,
    tva: 0.055,
    article: {
      id: 1,
      nom: 'Baguette',
      prix: 5,
      tva: 0.055,
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
            coutUnitaire: data.coutUnitaireMatiere,
            seuil: 1,
            conditionnement: 'sac',
          },
        },
      ],
    },
  }
}
