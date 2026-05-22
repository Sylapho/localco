import { IsInt, Min } from 'class-validator'

export class ProduceArticleDto {
  @IsInt()
  @Min(1)
  quantite: number
}