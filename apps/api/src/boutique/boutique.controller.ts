import { Controller, Get } from '@nestjs/common'
import { BoutiqueService } from './boutique.service'

@Controller('boutique')
export class BoutiqueController {
  constructor(private readonly boutiqueService: BoutiqueService) {}

  @Get('articles')
  findOnlineArticles() {
    return this.boutiqueService.findOnlineArticles()
  }
}
