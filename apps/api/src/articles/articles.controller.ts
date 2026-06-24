import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { ArticlesService } from './articles.service'
import { CreateArticleDto } from './dto/create-article.dto'
import { UpdateArticleDto } from './dto/update-article.dto'
import { ProduceArticleDto } from './dto/produce-article.dto'
import {
  ARTICLE_IMAGE_MAX_SIZE_BYTES,
  ARTICLE_IMAGE_UPLOAD_DIR,
  articleImageFileFilter,
  buildArticleImageFilename,
  buildArticleImagePath,
} from './article-image-upload'
import { BetterAuthGuard } from '../auth/better-auth.guard'
import { Roles } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import { ROLES } from '../auth/roles'

type UploadedArticleImage = {
  filename: string
}

@Controller('articles')
@UseGuards(BetterAuthGuard, RolesGuard)
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  @Roles(ROLES.GERANT, ROLES.VENDEUR, ROLES.PRODUCTION, ROLES.STOCK)
  findAll() {
    return this.articlesService.findAll()
  }

  @Get(':id/capacity')
  @Roles(ROLES.GERANT, ROLES.PRODUCTION, ROLES.STOCK)
  getProductionCapacity(@Param('id', ParseIntPipe) id: number) {
    return this.articlesService.getProductionCapacity(id)
  }

  @Post(':id/produce')
  @Roles(ROLES.GERANT, ROLES.PRODUCTION)
  produce(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ProduceArticleDto,
  ) {
    return this.articlesService.produce(id, body)
  }

  @Get(':id')
  @Roles(ROLES.GERANT, ROLES.VENDEUR, ROLES.PRODUCTION, ROLES.STOCK)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.articlesService.findOne(id)
  }

  @Post()
  @Roles(ROLES.GERANT)
  create(@Body() body: CreateArticleDto) {
    return this.articlesService.create(body)
  }

  @Patch(':id')
  @Roles(ROLES.GERANT)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateArticleDto,
  ) {
    return this.articlesService.update(id, body)
  }

  @Post(':id/image')
  @Roles(ROLES.GERANT)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: ARTICLE_IMAGE_UPLOAD_DIR,
        filename: (req, file, callback) => {
          callback(
            null,
            buildArticleImageFilename(String(req.params.id), file.mimetype),
          )
        },
      }),
      fileFilter: articleImageFileFilter,
      limits: {
        fileSize: ARTICLE_IMAGE_MAX_SIZE_BYTES,
      },
    }),
  )
  async uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file?: UploadedArticleImage,
  ) {
    if (!file) {
      throw new BadRequestException('Aucune image fournie.')
    }

    return this.articlesService.updateImage(
      id,
      buildArticleImagePath(file.filename),
      file.filename,
    )
  }

  @Delete(':id')
  @Roles(ROLES.GERANT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.articlesService.remove(id)
  }
}
