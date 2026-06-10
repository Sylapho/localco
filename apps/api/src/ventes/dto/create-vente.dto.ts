import { Type } from 'class-transformer'
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator'

class CreateLigneVenteDto {
  @IsInt()
  articleId!: number

  @IsInt()
  @Min(1)
  quantite!: number
}

export class CreateVenteDto {
  @IsIn(['cb', 'especes', 'cheque'])
  mode!: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  remiseCents?: number

  @IsOptional()
  @IsInt()
  userId?: number

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLigneVenteDto)
  lignes!: CreateLigneVenteDto[]
}
