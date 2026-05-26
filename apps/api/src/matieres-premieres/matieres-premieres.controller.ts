import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { MatieresPremieresService } from './matieres-premieres.service'
import { CreateMatierePremiereDto } from './dto/create-matiere-premiere.dto'
import { UpdateMatierePremiereDto } from './dto/update-matiere-premiere.dto'
import { BetterAuthGuard } from '../auth/better-auth.guard'
import { Roles } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import { ROLES } from '../auth/roles'

@Controller('matieres-premieres')
@UseGuards(BetterAuthGuard, RolesGuard)
export class MatieresPremieresController {
  constructor(
    private readonly matieresPremieresService: MatieresPremieresService,
  ) {}

  @Get()
  @Roles(ROLES.GERANT, ROLES.PRODUCTION, ROLES.STOCK)
  findAll() {
    return this.matieresPremieresService.findAll()
  }

  @Get(':id')
  @Roles(ROLES.GERANT, ROLES.PRODUCTION, ROLES.STOCK)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.matieresPremieresService.findOne(id)
  }

  @Post()
  @Roles(ROLES.GERANT, ROLES.STOCK)
  create(@Body() body: CreateMatierePremiereDto) {
    return this.matieresPremieresService.create(body)
  }

  @Patch(':id')
  @Roles(ROLES.GERANT, ROLES.STOCK)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateMatierePremiereDto,
  ) {
    return this.matieresPremieresService.update(id, body)
  }

  @Delete(':id')
  @Roles(ROLES.GERANT, ROLES.STOCK)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.matieresPremieresService.remove(id)
  }
}
