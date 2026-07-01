import { Injectable } from '@nestjs/common'

export type PublicCommandeSummary = {
  trackingToken: string
  reference: string
  totalTtcCents: number
  lieu: string
  dateRetrait: string | null
  statut: string
  paiementStatut: 'confirme' | 'en_attente' | 'a_verifier' | 'annule'
  createdAt: string
  lignes: {
    nom: string
    quantite: number
    prixUnitCents: number
    totalCents: number
  }[]
}

@Injectable()
export class CommandePublicSummaryService {
  toPublicCommandeSummary(commande: {
    id: number
    trackingToken: string
    totalTtcCents: number
    lieu: string
    dateRetrait?: Date | null
    statut: string
    createdAt: Date
    lignes: {
      quantite: number
      prixUnitCents: number
      article: {
        nom: string
      }
    }[]
  }): PublicCommandeSummary {
    return {
      trackingToken: commande.trackingToken,
      reference: this.formatCommandeReference(commande.id),
      totalTtcCents: commande.totalTtcCents,
      lieu: commande.lieu,
      dateRetrait: commande.dateRetrait?.toISOString() ?? null,
      statut: commande.statut,
      paiementStatut: this.getPublicPaymentStatus(commande.statut),
      createdAt: commande.createdAt.toISOString(),
      lignes: commande.lignes.map((ligne) => ({
        nom: ligne.article.nom,
        quantite: ligne.quantite,
        prixUnitCents: ligne.prixUnitCents,
        totalCents: ligne.prixUnitCents * ligne.quantite,
      })),
    }
  }

  private formatCommandeReference(id: number) {
    return `CMD-${String(id).padStart(6, '0')}`
  }

  private getPublicPaymentStatus(statut: string) {
    if (statut === 'annulee') {
      return 'annule'
    }

    if (statut === 'paiement_en_attente') {
      return 'en_attente'
    }

    if (statut === 'paiement_a_verifier') {
      return 'a_verifier'
    }

    return 'confirme'
  }
}
