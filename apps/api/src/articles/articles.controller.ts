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
import { ArticlesService } from './articles.service'
import { CreateArticleDto } from './dto/create-article.dto'
import { UpdateArticleDto } from './dto/update-article.dto'
import { ProduceArticleDto } from './dto/produce-article.dto'

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  findAll() {
    return this.articlesService.findAll()
  }

  @Get(':id/capacity')
  getProductionCapacity(@Param('id', ParseIntPipe) id: number) {
    return this.articlesService.getProductionCapacity(id)
  }

  @Post(':id/produce')
  produce(@Param('id', ParseIntPipe) id: number, @Body() body: ProduceArticleDto) {
    return this.articlesService.produce(id, body.quantite)
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.articlesService.findOne(id)
  }

  @Post()
  create(@Body() body: CreateArticleDto) {
    return this.articlesService.create(body)
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateArticleDto,
  ) {
    return this.articlesService.update(id, body)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.articlesService.remove(id)
  }
}