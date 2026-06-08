import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class CreateArticleDto {
  @IsString()
  nom: string

  @IsNumber()
  @Min(0)
  prixCents: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  tvaBps?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number

  @IsOptional()
  @IsBoolean()
  online?: boolean

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  ingredients?: string | null

  @IsOptional()
  @IsString()
  allergenes?: string | null

  @IsOptional()
  @IsString()
  imageUrl?: string | null
}
