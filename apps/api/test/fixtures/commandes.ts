import { PrismaService } from '../../src/prisma/prisma.service'
import { validPickupPoint } from './dates'

export function createPendingCommande(
  prisma: PrismaService,
  data: {
    articleId: number
    quantite: number
    prixUnitCents: number
    stripeId: string
    createdAt?: Date
  },
) {
  return prisma.commande.create({
    data: {
      trackingToken: `e2e-pending-${data.stripeId}`,
      nom: 'Client E2E',
      email: 'client.e2e@example.com',
      tel: '0600000000',
      lieu: validPickupPoint,
      totalTtcCents: data.prixUnitCents * data.quantite,
      statut: 'paiement_en_attente',
      stripeId: data.stripeId,
      createdAt: data.createdAt,
      lignes: {
        create: [
          {
            articleId: data.articleId,
            quantite: data.quantite,
            prixUnitCents: data.prixUnitCents,
          },
        ],
      },
      historique: {
        create: [
          {
            ancienStatut: null,
            nouveauStatut: 'paiement_en_attente',
            motif: 'checkout_cree',
          },
        ],
      },
    },
  })
}
