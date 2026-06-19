import { Transform } from 'class-transformer'
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value
}

export class CreatePickupPointDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  label!: string

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(240)
  address!: string

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  schedule!: string

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  allowedWeekdays!: number[]

  @IsOptional()
  @Transform(({ value }) => {
    const trimmed = trimString(value)
    return trimmed === '' ? undefined : trimmed
  })
  @IsDateString()
  alternatingWeekAnchorDate?: string

  @IsOptional()
  @IsBoolean()
  active?: boolean
}
