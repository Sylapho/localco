import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../prisma/prisma.service'
import { MatieresPremieresService } from './matieres-premieres.service'

describe('MatieresPremieresService', () => {
  let service: MatieresPremieresService

  const prismaMock = {
    matierePremiere: {
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatieresPremieresService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile()

    service = module.get<MatieresPremieresService>(MatieresPremieresService)
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('findAll should return matieres premieres ordered by name', async () => {
    const matieres = [{ id: 1, nom: 'Farine', stock: 10 }]
    prismaMock.matierePremiere.findMany.mockResolvedValue(matieres)

    await expect(service.findAll()).resolves.toEqual(matieres)
    expect(prismaMock.matierePremiere.findMany).toHaveBeenCalledWith({
      orderBy: {
        nom: 'asc',
      },
    })
  })

  it('findOne should return one matiere premiere', async () => {
    const matiere = { id: 1, nom: 'Farine', stock: 10 }
    prismaMock.matierePremiere.findUniqueOrThrow.mockResolvedValue(matiere)

    await expect(service.findOne(1)).resolves.toEqual(matiere)
    expect(prismaMock.matierePremiere.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 1 },
    })
  })

  it('create should create a matiere premiere', async () => {
    const body = {
      nom: 'Farine',
      stock: 10,
      unite: 'kg',
      coutUnitaireCents: 120,
      seuil: 2,
      conditionnement: 'sac',
    }
    const created = { id: 1, ...body }

    prismaMock.matierePremiere.create.mockResolvedValue(created)

    await expect(service.create(body)).resolves.toEqual(created)
    expect(prismaMock.matierePremiere.create).toHaveBeenCalledWith({
      data: body,
    })
  })

  it('update should update a matiere premiere', async () => {
    const updated = { id: 1, nom: 'Farine T65', stock: 10 }
    prismaMock.matierePremiere.update.mockResolvedValue(updated)

    await expect(service.update(1, { nom: 'Farine T65' })).resolves.toEqual(
      updated,
    )
    expect(prismaMock.matierePremiere.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { nom: 'Farine T65' },
    })
  })

  it('remove should delete a matiere premiere', async () => {
    const deleted = { id: 1, nom: 'Farine' }
    prismaMock.matierePremiere.delete.mockResolvedValue(deleted)

    await expect(service.remove(1)).resolves.toEqual(deleted)
    expect(prismaMock.matierePremiere.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    })
  })
})
