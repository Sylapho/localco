import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'

export class ReceptionMatiereDto {
  @IsNumber()
  @Min(0.001)
  quantite!: number

  @IsOptional()
  @IsString()
  motif?: string

  @IsOptional()
  @IsDateString()
  expiresAt?: string
}
