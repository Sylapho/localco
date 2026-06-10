import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

class CreateCommandeLineDto {
  @IsInt()
  articleId!: number

  @IsInt()
  @Min(1)
  @Max(99)
  quantite!: number
}

export class CreateCommandeDto {
  @IsString()
  @MaxLength(120)
  nom!: string

  @IsEmail()
  @MaxLength(254)
  email!: string

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[+0-9 ().-]+$/)
  tel?: string

  @IsString()
  @MaxLength(120)
  lieu!: string

  @IsOptional()
  @IsDateString()
  dateRetrait?: string

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCommandeLineDto)
  lignes!: CreateCommandeLineDto[]
}
