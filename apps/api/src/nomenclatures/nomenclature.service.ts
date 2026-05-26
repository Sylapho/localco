import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateNomenclatureDto } from './dto/create-nomenclature.dto'
import { UpdateNomenclatureDto } from './dto/update-nomenclature.dto'

@Injectable()
export class NomenclatureService {
  constructor(private readonly prisma: PrismaService) {}

  findByArticle(articleId: number) {
    return this.prisma.nomenclature.findMany({
      where: { articleId },
      include: {
        article: true,
        mp: true,
      },
      orderBy: {
        mp: {
          nom: 'asc',
        },
      },
    })
  }

  create(articleId: number, data: CreateNomenclatureDto) {
    return this.prisma.nomenclature.create({
      data: {
        articleId,
        mpId: data.mpId,
        quantite: data.quantite,
      },
      include: {
        article: true,
        mp: true,
      },
    })
  }

  update(articleId: number, mpId: number, data: UpdateNomenclatureDto) {
    return this.prisma.nomenclature.update({
      where: {
        articleId_mpId: {
          articleId,
          mpId,
        },
      },
      data: {
        quantite: data.quantite,
      },
      include: {
        article: true,
        mp: true,
      },
    })
  }

  remove(articleId: number, mpId: number) {
    return this.prisma.nomenclature.delete({
      where: {
        articleId_mpId: {
          articleId,
          mpId,
        },
      },
    })
  }
}
