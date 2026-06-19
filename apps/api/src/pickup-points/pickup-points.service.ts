import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import {
  getPublicPickupPoints,
  validatePickupSlot,
  type PickupPoint,
} from '../commandes/pickup-slots'
import { CreatePickupPointDto } from './dto/create-pickup-point.dto'
import { UpdatePickupPointDto } from './dto/update-pickup-point.dto'

type PickupPointWriteData = {
  label?: string
  address?: string
  schedule?: string
  allowedWeekdays?: number[]
  alternatingWeekAnchorDate?: string | null
  active?: boolean
}

@Injectable()
export class PickupPointsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.pickupPoint.findMany({
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
  }

  async findActive() {
    return this.prisma.pickupPoint.findMany({
      where: {
        active: true,
      },
      orderBy: {
        id: 'asc',
      },
    })
  }

  async findPublicPickupPoints() {
    return getPublicPickupPoints(await this.findActive())
  }

  async validatePickupSlot(lieu: string, dateRetrait?: string) {
    const pickupPoints = await this.findActive()

    validatePickupSlot(lieu, dateRetrait, pickupPoints)
  }

  async create(data: CreatePickupPointDto) {
    try {
      return await this.prisma.pickupPoint.create({
        data: this.toCreateData(data),
      })
    } catch (error) {
      this.handleWriteError(error)
    }
  }

  async update(id: number, data: UpdatePickupPointDto) {
    await this.ensureExists(id)

    try {
      return await this.prisma.pickupPoint.update({
        where: { id },
        data: this.toUpdateData(data),
      })
    } catch (error) {
      this.handleWriteError(error)
    }
  }

  async deactivate(id: number) {
    return this.setActive(id, false)
  }

  async reactivate(id: number) {
    return this.setActive(id, true)
  }

  private async setActive(id: number, active: boolean) {
    await this.ensureExists(id)

    return this.prisma.pickupPoint.update({
      where: { id },
      data: { active },
    })
  }

  private async ensureExists(id: number) {
    const pickupPoint = await this.prisma.pickupPoint.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!pickupPoint) {
      throw new NotFoundException('Point de retrait introuvable')
    }
  }

  private toCreateData(
    data: CreatePickupPointDto,
  ): Required<PickupPointWriteData> {
    return {
      label: data.label,
      address: data.address,
      schedule: data.schedule,
      allowedWeekdays: this.normalizeAllowedWeekdays(data.allowedWeekdays),
      alternatingWeekAnchorDate: data.alternatingWeekAnchorDate ?? null,
      active: data.active ?? true,
    }
  }

  private toUpdateData(data: UpdatePickupPointDto): PickupPointWriteData {
    return {
      label: data.label,
      address: data.address,
      schedule: data.schedule,
      allowedWeekdays: data.allowedWeekdays
        ? this.normalizeAllowedWeekdays(data.allowedWeekdays)
        : undefined,
      alternatingWeekAnchorDate:
        data.alternatingWeekAnchorDate === undefined
          ? undefined
          : (data.alternatingWeekAnchorDate ?? null),
      active: data.active,
    }
  }

  private normalizeAllowedWeekdays(
    allowedWeekdays: PickupPoint['allowedWeekdays'],
  ) {
    return Array.from(new Set(allowedWeekdays)).sort(
      (left, right) => left - right,
    )
  }

  private handleWriteError(error: unknown): never {
    if (this.isPrismaError(error, 'P2002')) {
      throw new ConflictException(
        'Un point de retrait existe déjà avec ce nom et cet horaire',
      )
    }

    throw error
  }

  private isPrismaError(error: unknown, code: string) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === code
    )
  }
}
