import { PartialType } from '@nestjs/mapped-types'
import { CreateMatierePremiereDto } from './create-matiere-premiere.dto'

export class UpdateMatierePremiereDto extends PartialType(
  CreateMatierePremiereDto,
) {}
