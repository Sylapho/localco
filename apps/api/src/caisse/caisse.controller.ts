import { Controller, Get, Post, UseGuards } from '@nestjs/common'
import { CaisseService } from './caisse.service'
import { BetterAuthGuard } from '../auth/better-auth.guard'
import { Roles } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import { ROLES } from '../auth/roles'

@Controller('caisse')
@UseGuards(BetterAuthGuard, RolesGuard)
export class CaisseController {
  constructor(private readonly caisseService: CaisseService) {}

  @Get('today')
  @Roles(ROLES.GERANT, ROLES.VENDEUR, ROLES.COMPTABLE)
  getToday() {
    return this.caisseService.getTodaySummary()
  }

  @Get('journees')
  @Roles(ROLES.GERANT, ROLES.COMPTABLE)
  findClosedDays() {
    return this.caisseService.findClosedDays()
  }

  @Post('cloturer')
  @Roles(ROLES.GERANT, ROLES.COMPTABLE)
  cloturer() {
    return this.caisseService.closeToday()
  }
}
