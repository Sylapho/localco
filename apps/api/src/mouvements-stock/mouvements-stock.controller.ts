import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { BetterAuthGuard } from '../auth/better-auth.guard'
import { ROLES } from '../auth/roles'
import { Roles } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import { CreateAjustementStockDto } from './dto/create-ajustement-stock.dto'
import { ReceptionMatiereDto } from './dto/reception-matiere.dto'
import { MouvementsStockService } from './mouvements-stock.service'

type RequestWithUser = {
  userId?: string
}

@Controller('mouvements-stock')
@UseGuards(BetterAuthGuard, RolesGuard)
export class MouvementsStockController {
  constructor(
    private readonly mouvementsStockService: MouvementsStockService,
  ) {}

  @Get()
  @Roles(ROLES.GERANT, ROLES.STOCK, ROLES.PRODUCTION, ROLES.COMPTABLE)
  findAll() {
    return this.mouvementsStockService.findAll()
  }

  @Get('lots')
  @Roles(ROLES.GERANT, ROLES.STOCK, ROLES.PRODUCTION, ROLES.COMPTABLE)
  findLots() {
    return this.mouvementsStockService.findLots()
  }

  @Post('ajustement')
  @Roles(ROLES.GERANT, ROLES.STOCK)
  createAjustement(
    @Body() body: CreateAjustementStockDto,
    @Req() request: RequestWithUser,
  ) {
    return this.mouvementsStockService.createAjustement(body, request.userId)
  }

  @Post('matieres-premieres/:id/reception')
  @Roles(ROLES.GERANT, ROLES.STOCK)
  createReceptionMatiere(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReceptionMatiereDto,
    @Req() request: RequestWithUser,
  ) {
    return this.mouvementsStockService.createReceptionMatiere(
      id,
      body,
      request.userId,
    )
  }

  @Post('lots/:id/perte')
  @Roles(ROLES.GERANT, ROLES.STOCK)
  markLotAsLoss(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: RequestWithUser,
  ) {
    return this.mouvementsStockService.markLotAsLoss(id, request.userId)
  }
}
