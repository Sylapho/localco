import { PrismaService } from '../../src/prisma/prisma.service'

export function createArticle(
  prisma: PrismaService,
  data: {
    nom?: string
    prixCents?: number
    stock?: number
    online?: boolean
  } = {},
) {
  return prisma.article.create({
    data: {
      nom: data.nom ?? `Article E2E ${Date.now()}`,
      prixCents: data.prixCents ?? 250,
      stock: data.stock ?? 0,
      online: data.online ?? true,
    },
  })
}
