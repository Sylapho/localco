import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator'

export class CreateAjustementStockDto {
  @IsIn(['article', 'matiere_premiere'])
  cible!: 'article' | 'matiere_premiere'

  @IsInt()
  cibleId!: number

  @IsNumber()
  quantite!: number

  @IsOptional()
  @IsString()
  motif?: string

  @IsOptional()
  @IsDateString()
  expiresAt?: string
}
