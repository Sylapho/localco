import { IsInt, IsNumber, Min } from 'class-validator'

export class CreateNomenclatureDto {
  @IsInt()
  mpId!: number

  @IsNumber()
  @Min(0)
  quantite!: number
}
