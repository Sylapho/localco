import { ArticleCategory } from '../../../prisma/generated/prisma/client'
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'

export class CreateArticleDto {
  @IsString()
  nom!: string

  @IsOptional()
  @IsEnum(ArticleCategory)
  category?: ArticleCategory

  @IsNumber()
  @Min(0)
  prixCents!: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  tvaBps?: number

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
