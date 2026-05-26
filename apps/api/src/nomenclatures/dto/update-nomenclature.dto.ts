import { IsNumber, Min } from 'class-validator'

export class UpdateNomenclatureDto {
  @IsNumber()
  @Min(0)
  quantite: number
}
