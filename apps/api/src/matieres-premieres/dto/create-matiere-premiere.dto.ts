import { IsNumber, IsString, Min } from 'class-validator'

export class CreateMatierePremiereDto {
  @IsString()
  nom: string

  @IsNumber()
  @Min(0)
  stock: number

  @IsString()
  unite: string

  @IsNumber()
  @Min(0)
  coutUnitaire: number

  @IsNumber()
  @Min(0)
  seuil: number

  @IsString()
  conditionnement: string
}