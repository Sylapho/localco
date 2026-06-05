import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import { BetterAuthGuard } from '../auth/better-auth.guard'
import { ROLES } from '../auth/roles'
import { Roles } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import { CommandesService } from './commandes.service'
import { CreateCommandeDto } from './dto/create-commande.dto'
import { UpdateCommandeStatutDto } from './dto/update-commande-statut.dto'

@Controller('commandes')
export class CommandesController {
  constructor(private readonly commandesService: CommandesService) {}

  @Post('checkout')
  createCheckout(@Body() body: CreateCommandeDto) {
    return this.commandesService.createCheckout(body)
  }

  @Post('stripe/webhook')
  handleStripeWebhook(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature?: string | string[],
  ) {
    return this.commandesService.handleStripeWebhook(request.rawBody, signature)
  }

  @Post()
  create(@Body() body: CreateCommandeDto) {
    return this.commandesService.create(body)
  }

  @Get()
  @UseGuards(BetterAuthGuard, RolesGuard)
  @Roles(ROLES.GERANT, ROLES.VENDEUR, ROLES.PRODUCTION, ROLES.COMPTABLE)
  findAll() {
    return this.commandesService.findAll()
  }

  @Post('cleanup-abandoned')
  @UseGuards(BetterAuthGuard, RolesGuard)
  @Roles(ROLES.GERANT)
  cleanupAbandoned() {
    return this.commandesService.cleanupAbandonedCommandes()
  }

  @Get('checkout-session/:sessionId')
  findCheckoutSessionSummary(@Param('sessionId') sessionId: string) {
    return this.commandesService.findPublicCheckoutSummary(sessionId)
  }

  @Get(':id')
  @UseGuards(BetterAuthGuard, RolesGuard)
  @Roles(ROLES.GERANT, ROLES.VENDEUR, ROLES.PRODUCTION, ROLES.COMPTABLE)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.commandesService.findOne(id)
  }

  @Patch(':id/statut')
  @UseGuards(BetterAuthGuard, RolesGuard)
  @Roles(ROLES.GERANT, ROLES.VENDEUR, ROLES.PRODUCTION)
  updateStatut(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCommandeStatutDto,
  ) {
    return this.commandesService.updateStatut(id, body.statut)
  }
}
