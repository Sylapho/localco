import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { BetterAuthGuard } from '../auth/better-auth.guard'
import { ROLES } from '../auth/roles'
import { Roles } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import { CreatePickupPointDto } from './dto/create-pickup-point.dto'
import { UpdatePickupPointDto } from './dto/update-pickup-point.dto'
import { PickupPointsService } from './pickup-points.service'

@Controller('pickup-points')
@UseGuards(BetterAuthGuard, RolesGuard)
@Roles(ROLES.GERANT)
export class PickupPointsController {
  constructor(private readonly pickupPointsService: PickupPointsService) {}

  @Get()
  findAll() {
    return this.pickupPointsService.findAll()
  }

  @Post()
  create(@Body() body: CreatePickupPointDto) {
    return this.pickupPointsService.create(body)
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdatePickupPointDto,
  ) {
    return this.pickupPointsService.update(id, body)
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.pickupPointsService.deactivate(id)
  }

  @Patch(':id/reactivate')
  reactivate(@Param('id', ParseIntPipe) id: number) {
    return this.pickupPointsService.reactivate(id)
  }
}
