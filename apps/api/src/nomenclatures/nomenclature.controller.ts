import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common'
import { NomenclatureService } from './nomenclature.service'
import { CreateNomenclatureDto } from './dto/create-nomenclature.dto'
import { UpdateNomenclatureDto } from './dto/update-nomenclature.dto'

@Controller('articles/:articleId/nomenclature')
export class NomenclatureController {
  constructor(private readonly nomenclatureService: NomenclatureService) {}

  @Get()
  findByArticle(@Param('articleId', ParseIntPipe) articleId: number) {
    return this.nomenclatureService.findByArticle(articleId)
  }

  @Post()
  create(
    @Param('articleId', ParseIntPipe) articleId: number,
    @Body() body: CreateNomenclatureDto,
  ) {
    return this.nomenclatureService.create(articleId, body)
  }

  @Patch(':mpId')
  update(
    @Param('articleId', ParseIntPipe) articleId: number,
    @Param('mpId', ParseIntPipe) mpId: number,
    @Body() body: UpdateNomenclatureDto,
  ) {
    return this.nomenclatureService.update(articleId, mpId, body)
  }

  @Delete(':mpId')
  remove(
    @Param('articleId', ParseIntPipe) articleId: number,
    @Param('mpId', ParseIntPipe) mpId: number,
  ) {
    return this.nomenclatureService.remove(articleId, mpId)
  }
}