import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common'
import { VentesService } from './ventes.service'
import { CreateVenteDto } from './dto/create-vente.dto'
import { BetterAuthGuard } from '../auth/better-auth.guard'
import { Roles } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import { ROLES } from '../auth/roles'

@Controller('ventes')
@UseGuards(BetterAuthGuard, RolesGuard)
export class VentesController {
  constructor(private readonly ventesService: VentesService) {}

  @Get()
  @Roles(ROLES.GERANT, ROLES.VENDEUR, ROLES.COMPTABLE)
  findAll() {
    return this.ventesService.findAll()
  }

  @Get(':id')
  @Roles(ROLES.GERANT, ROLES.VENDEUR, ROLES.COMPTABLE)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ventesService.findOne(id)
  }

  @Post()
  @Roles(ROLES.GERANT, ROLES.VENDEUR)
  create(@Body() body: CreateVenteDto) {
    return this.ventesService.create(body)
  }
}
