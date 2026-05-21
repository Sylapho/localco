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
import { MatieresPremieresService } from './matieres-premieres.service'
import { CreateMatierePremiereDto } from './dto/create-matiere-premiere.dto'
import { UpdateMatierePremiereDto } from './dto/update-matiere-premiere.dto'

@Controller('matieres-premieres')
export class MatieresPremieresController {
  constructor(
    private readonly matieresPremieresService: MatieresPremieresService,
  ) {}

  @Get()
  findAll() {
    return this.matieresPremieresService.findAll()
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.matieresPremieresService.findOne(id)
  }

  @Post()
  create(@Body() body: CreateMatierePremiereDto) {
    return this.matieresPremieresService.create(body)
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateMatierePremiereDto,
  ) {
    return this.matieresPremieresService.update(id, body)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.matieresPremieresService.remove(id)
  }
}