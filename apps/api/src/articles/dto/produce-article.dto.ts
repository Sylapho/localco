import { IsDateString, IsInt, IsOptional, Min } from 'class-validator'

export class ProduceArticleDto {
  @IsInt()
  @Min(1)
  quantite!: number

  @IsOptional()
  @IsDateString()
  expiresAt?: string
}
