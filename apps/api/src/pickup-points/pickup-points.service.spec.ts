import { BadRequestException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { PickupPointsService } from './pickup-points.service'

describe('PickupPointsService', () => {
  const prismaMock = {
    pickupPoint: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  }

  let service: PickupPointsService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new PickupPointsService(prismaMock as unknown as PrismaService)
  })

  it('findAll should return pickup points with merchant ordering', async () => {
    const result = [
      {
        id: 1,
        label: 'MarchÃ© de Caen',
        schedule: '10h00 - 12h00',
        active: true,
      },
    ]
    prismaMock.pickupPoint.findMany.mockResolvedValue(result)

    await expect(service.findAll()).resolves.toEqual(result)
    expect(prismaMock.pickupPoint.findMany).toHaveBeenCalledWith({
      orderBy: [
        {
          active: 'desc',
        },
        {
          label: 'asc',
        },
        {
          schedule: 'asc',
        },
      ],
    })
  })

  it('creates a pickup point with normalized weekdays', async () => {
    const created = {
      id: 1,
      label: 'Marché de Caen',
      address: '12 rue Exemple, 14000 Caen',
      schedule: '10h00 - 12h00',
      allowedWeekdays: [3, 6],
      alternatingWeekAnchorDate: null,
      active: true,
    }
    prismaMock.pickupPoint.create.mockResolvedValue(created)

    await expect(
      service.create({
        label: 'Marché de Caen',
        address: '12 rue Exemple, 14000 Caen',
        schedule: '10h00 - 12h00',
        allowedWeekdays: [6, 3],
      }),
    ).resolves.toEqual(created)

    expect(prismaMock.pickupPoint.create).toHaveBeenCalledWith({
      data: {
        label: 'Marché de Caen',
        address: '12 rue Exemple, 14000 Caen',
        schedule: '10h00 - 12h00',
        allowedWeekdays: [3, 6],
        alternatingWeekAnchorDate: null,
        active: true,
      },
    })
  })

  it('updates a pickup point', async () => {
    prismaMock.pickupPoint.findUnique.mockResolvedValue({ id: 1 })
    prismaMock.pickupPoint.update.mockResolvedValue({
      id: 1,
      schedule: '16h00 - 18h00',
    })

    await expect(
      service.update(1, {
        schedule: '16h00 - 18h00',
        allowedWeekdays: [5],
      }),
    ).resolves.toMatchObject({
      id: 1,
      schedule: '16h00 - 18h00',
    })

    expect(prismaMock.pickupPoint.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        label: undefined,
        address: undefined,
        schedule: '16h00 - 18h00',
        allowedWeekdays: [5],
        alternatingWeekAnchorDate: undefined,
        active: undefined,
      },
    })
  })

  it('deactivates a pickup point instead of deleting it', async () => {
    prismaMock.pickupPoint.findUnique.mockResolvedValue({ id: 1 })
    prismaMock.pickupPoint.update.mockResolvedValue({ id: 1, active: false })

    await expect(service.deactivate(1)).resolves.toEqual({
      id: 1,
      active: false,
    })

    expect(prismaMock.pickupPoint.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { active: false },
    })
  })

  it('reactivates a pickup point', async () => {
    prismaMock.pickupPoint.findUnique.mockResolvedValue({ id: 1 })
    prismaMock.pickupPoint.update.mockResolvedValue({ id: 1, active: true })

    await expect(service.reactivate(1)).resolves.toEqual({
      id: 1,
      active: true,
    })

    expect(prismaMock.pickupPoint.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { active: true },
    })
  })

  it('returns only active pickup points for the public checkout', async () => {
    prismaMock.pickupPoint.findMany.mockResolvedValue([
      {
        id: 1,
        label: 'Marché de Gaillon',
        address: 'Marché de Gaillon',
        schedule: 'Mardi matin, 8h-12h',
        allowedWeekdays: [2],
        alternatingWeekAnchorDate: null,
        active: true,
      },
    ])

    await expect(service.findPublicPickupPoints()).resolves.toEqual([
      expect.objectContaining({
        label: 'Marché de Gaillon',
        value: 'Marché de Gaillon - Mardi matin, 8h-12h',
      }),
    ])

    expect(prismaMock.pickupPoint.findMany).toHaveBeenCalledWith({
      where: {
        active: true,
      },
      orderBy: {
        id: 'asc',
      },
    })
  })

  it('rejects pickup dates that do not match the selected point weekdays', async () => {
    prismaMock.pickupPoint.findMany.mockResolvedValue([
      {
        id: 1,
        label: 'Marché de Gaillon',
        address: 'Marché de Gaillon',
        schedule: 'Mardi matin, 8h-12h',
        allowedWeekdays: [2],
        alternatingWeekAnchorDate: null,
        active: true,
      },
    ])

    await expect(
      service.validatePickupSlot(
        'Marché de Gaillon - Mardi matin, 8h-12h',
        getNextDateForWeekday(3),
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects inactive pickup points because public validation only loads active ones', async () => {
    prismaMock.pickupPoint.findMany.mockResolvedValue([])

    await expect(
      service.validatePickupSlot(
        'Marché de Gaillon - Mardi matin, 8h-12h',
        getNextDateForWeekday(2),
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('maps duplicate label and schedule writes to an explicit conflict', async () => {
    prismaMock.pickupPoint.create.mockRejectedValue({ code: 'P2002' })

    await expect(
      service.create({
        label: 'Marché de Caen',
        address: '12 rue Exemple, 14000 Caen',
        schedule: '10h00 - 12h00',
        allowedWeekdays: [3],
      }),
    ).rejects.toBeInstanceOf(ConflictException)
  })
})

function getNextDateForWeekday(targetWeekday: number) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)

  do {
    date.setDate(date.getDate() + 1)
  } while (date.getDay() !== targetWeekday)

  return formatDateInput(date)
}

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
