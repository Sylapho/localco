import { PartialType } from '@nestjs/mapped-types'
import { CreatePickupPointDto } from './create-pickup-point.dto'

export class UpdatePickupPointDto extends PartialType(CreatePickupPointDto) {}
