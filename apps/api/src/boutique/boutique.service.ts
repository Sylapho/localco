import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class BoutiqueService {
  constructor(private readonly prisma: PrismaService) {}

  findOnlineArticles() {
    return this.prisma.article.findMany({
      where: {
        online: true,
      },
      orderBy: {
        nom: 'asc',
      },
    })
  }
}
