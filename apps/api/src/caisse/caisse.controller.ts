import { Controller, Get, Post } from '@nestjs/common'
import { CaisseService } from './caisse.service'

@Controller('caisse')
export class CaisseController {
  constructor(private readonly caisseService: CaisseService) {}

  @Get('today')
  getToday() {
    return this.caisseService.getTodaySummary()
  }

  @Post('cloturer')
  cloturer() {
    return this.caisseService.closeToday()
  }
}
