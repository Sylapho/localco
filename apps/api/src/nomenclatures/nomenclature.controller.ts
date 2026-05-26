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
import { NomenclatureService } from './nomenclature.service'
import { CreateNomenclatureDto } from './dto/create-nomenclature.dto'
import { UpdateNomenclatureDto } from './dto/update-nomenclature.dto'
import { BetterAuthGuard } from '../auth/better-auth.guard'
import { Roles } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import { ROLES } from '../auth/roles'

@Controller('articles/:articleId/nomenclature')
@UseGuards(BetterAuthGuard, RolesGuard)
export class NomenclatureController {
  constructor(private readonly nomenclatureService: NomenclatureService) {}

  @Get()
  @Roles(ROLES.GERANT, ROLES.PRODUCTION, ROLES.STOCK)
  findByArticle(@Param('articleId', ParseIntPipe) articleId: number) {
    return this.nomenclatureService.findByArticle(articleId)
  }

  @Post()
  @Roles(ROLES.GERANT, ROLES.PRODUCTION)
  create(
    @Param('articleId', ParseIntPipe) articleId: number,
    @Body() body: CreateNomenclatureDto,
  ) {
    return this.nomenclatureService.create(articleId, body)
  }

  @Patch(':mpId')
  @Roles(ROLES.GERANT, ROLES.PRODUCTION)
  update(
    @Param('articleId', ParseIntPipe) articleId: number,
    @Param('mpId', ParseIntPipe) mpId: number,
    @Body() body: UpdateNomenclatureDto,
  ) {
    return this.nomenclatureService.update(articleId, mpId, body)
  }

  @Delete(':mpId')
  @Roles(ROLES.GERANT, ROLES.PRODUCTION)
  remove(
    @Param('articleId', ParseIntPipe) articleId: number,
    @Param('mpId', ParseIntPipe) mpId: number,
  ) {
    return this.nomenclatureService.remove(articleId, mpId)
  }
}
