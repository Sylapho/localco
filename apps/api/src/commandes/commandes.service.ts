import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Stripe from 'stripe'
import { EmailsService } from '../emails/emails.service'
import { MouvementsStockService } from '../mouvements-stock/mouvements-stock.service'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCommandeDto } from './dto/create-commande.dto'
import { CommandeStatut } from './dto/update-commande-statut.dto'

@Injectable()
export class CommandesService {
  private stripe: InstanceType<typeof Stripe> | null = null
  private readonly abandonedDelayMinutes = 60

  constructor(
    private readonly prisma: PrismaService,
    private readonly mouvementsStockService: MouvementsStockService,
    private readonly configService: ConfigService,
    private readonly emailsService: EmailsService,
  ) {}

  async findAll() {
    await this.cleanupAbandonedCommandes()

    return this.prisma.commande.findMany({
      where: {
        statut: {
          not: 'paiement_en_attente',
        },
      },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  async findOne(id: number) {
    await this.cleanupAbandonedCommandes()

    return this.prisma.commande.findUniqueOrThrow({
      where: { id },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
        historique: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })
  }

  async create(data: CreateCommandeDto) {
    const { lignesAgregees, articles, totalTTC } =
      await this.prepareCommande(data)

    return this.prisma.$transaction(async (tx) => {
      const commande = await tx.commande.create({
        data: {
          nom: data.nom,
          email: data.email,
          tel: data.tel,
          lieu: data.lieu,
          dateRetrait: data.dateRetrait
            ? new Date(data.dateRetrait)
            : undefined,
          totalTTC,
          statut: 'nouvelle',
          lignes: {
            create: lignesAgregees.map((ligne) => {
              const article = articles.find(
                (item) => item.id === ligne.articleId,
              )!

              return {
                articleId: article.id,
                quantite: ligne.quantite,
                prixUnit: article.prix,
              }
            }),
          },
        },
        include: {
          lignes: {
            include: {
              article: true,
            },
          },
        },
      })

      await this.recordStatusHistory(tx, {
        commandeId: commande.id,
        ancienStatut: null,
        nouveauStatut: 'nouvelle',
        motif: 'creation_directe',
      })

      for (const ligne of lignesAgregees) {
        const article = articles.find((item) => item.id === ligne.articleId)!

        await tx.article.update({
          where: { id: article.id },
          data: {
            stock: {
              decrement: ligne.quantite,
            },
          },
        })

        await this.mouvementsStockService.recordArticleMovement(tx, {
          articleId: article.id,
          quantite: -ligne.quantite,
          stockAvant: article.stock,
          stockApres: article.stock - ligne.quantite,
          type: 'commande',
          motif: `Commande en ligne #${commande.id}`,
          reference: `commande:${commande.id}`,
        })
      }

      return commande
    })
  }

  async createCheckout(data: CreateCommandeDto) {
    const stripe = this.getStripe()
    const shopUrl =
      this.configService.get<string>('SHOP_PUBLIC_URL') ??
      'http://localhost:3001'
    const { lignesAgregees, articles, totalTTC } =
      await this.prepareCommande(data)

    const commande = await this.prisma.$transaction(async (tx) => {
      const created = await tx.commande.create({
        data: {
          nom: data.nom,
          email: data.email,
          tel: data.tel,
          lieu: data.lieu,
          dateRetrait: data.dateRetrait
            ? new Date(data.dateRetrait)
            : undefined,
          totalTTC,
          statut: 'paiement_en_attente',
          lignes: {
            create: lignesAgregees.map((ligne) => {
              const article = articles.find(
                (item) => item.id === ligne.articleId,
              )!

              return {
                articleId: article.id,
                quantite: ligne.quantite,
                prixUnit: article.prix,
              }
            }),
          },
        },
      })

      await this.recordStatusHistory(tx, {
        commandeId: created.id,
        ancienStatut: null,
        nouveauStatut: 'paiement_en_attente',
        motif: 'checkout_cree',
      })

      return created
    })

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: data.email,
      client_reference_id: String(commande.id),
      line_items: lignesAgregees.map((ligne) => {
        const article = articles.find((item) => item.id === ligne.articleId)!
        const images =
          article.imageUrl && article.imageUrl.startsWith('http')
            ? [article.imageUrl]
            : undefined

        return {
          quantity: ligne.quantite,
          price_data: {
            currency: 'eur',
            unit_amount: Math.round(article.prix * 100),
            product_data: {
              name: article.nom,
              images,
            },
          },
        }
      }),
      metadata: {
        commandeId: String(commande.id),
      },
      success_url: `${shopUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${shopUrl}/cancel`,
    })

    if (!session.url) {
      throw new BadRequestException(
        'Impossible de créer la session de paiement',
      )
    }

    await this.prisma.commande.update({
      where: { id: commande.id },
      data: { stripeId: session.id },
    })

    return { url: session.url }
  }

  async handleStripeWebhook(
    rawBody: Buffer | undefined,
    signature: string | string[] | undefined,
  ) {
    const stripe = this.getStripe()
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    )
    const stripeSignature = Array.isArray(signature) ? signature[0] : signature

    if (!webhookSecret || !stripeSignature || !rawBody) {
      throw new BadRequestException('Webhook Stripe invalide')
    }

    const event = stripe.webhooks.constructEvent(
      rawBody,
      stripeSignature,
      webhookSecret,
    )

    if (event.type === 'checkout.session.completed') {
      const confirmedOrder = await this.confirmPaidCommande(
        event.data.object.id,
      )

      if (confirmedOrder) {
        await this.emailsService.sendOrderConfirmation(confirmedOrder)
      }
    }

    if (event.type === 'checkout.session.expired') {
      await this.expirePendingCommande(event.data.object.id)
    }

    return { received: true }
  }

  async updateStatut(id: number, statut: CommandeStatut) {
    const commande = await this.findOne(id)

    if (commande.statut === 'annulee') {
      throw new BadRequestException('Une commande annulée ne peut plus changer')
    }

    if (commande.statut === 'traitee') {
      throw new BadRequestException('Une commande traitée ne peut plus changer')
    }

    if (commande.statut === 'paiement_en_attente' && statut !== 'annulee') {
      throw new BadRequestException(
        'Le paiement de cette commande est en attente',
      )
    }

    if (commande.statut === 'paiement_a_verifier' && statut !== 'annulee') {
      throw new BadRequestException(
        'Le stock de cette commande doit être vérifié',
      )
    }

    if (statut === 'annulee') {
      return this.cancelCommande(id)
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.commande.update({
        where: { id },
        data: { statut },
        include: {
          lignes: {
            include: {
              article: true,
            },
          },
        },
      })

      await this.recordStatusHistory(tx, {
        commandeId: id,
        ancienStatut: commande.statut,
        nouveauStatut: statut,
        motif: 'statut_modifie',
      })

      return updated
    })
  }

  async cleanupAbandonedCommandes() {
    const cutoff = new Date(Date.now() - this.abandonedDelayMinutes * 60 * 1000)

    const commandes = await this.prisma.commande.findMany({
      where: {
        statut: 'paiement_en_attente',
        createdAt: {
          lt: cutoff,
        },
      },
      select: {
        id: true,
        statut: true,
      },
    })

    if (commandes.length === 0) {
      return { count: 0 }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const commande of commandes) {
        await tx.commande.update({
          where: { id: commande.id },
          data: { statut: 'annulee' },
        })

        await this.recordStatusHistory(tx, {
          commandeId: commande.id,
          ancienStatut: commande.statut,
          nouveauStatut: 'annulee',
          motif: 'commande_abandonnee',
        })
      }
    })

    return { count: commandes.length }
  }

  private async cancelCommande(id: number) {
    const commande = await this.findOne(id)

    if (
      commande.statut === 'paiement_en_attente' ||
      commande.statut === 'paiement_a_verifier'
    ) {
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.commande.update({
          where: { id },
          data: { statut: 'annulee' },
          include: {
            lignes: {
              include: {
                article: true,
              },
            },
          },
        })

        await this.recordStatusHistory(tx, {
          commandeId: id,
          ancienStatut: commande.statut,
          nouveauStatut: 'annulee',
          motif: 'annulation',
        })

        return updated
      })
    }

    return this.prisma.$transaction(async (tx) => {
      for (const ligne of commande.lignes) {
        const article = await tx.article.update({
          where: { id: ligne.articleId },
          data: {
            stock: {
              increment: ligne.quantite,
            },
          },
        })

        await this.mouvementsStockService.recordArticleMovement(tx, {
          articleId: ligne.articleId,
          quantite: ligne.quantite,
          stockAvant: article.stock - ligne.quantite,
          stockApres: article.stock,
          type: 'commande',
          motif: `Annulation commande #${id}`,
          reference: `commande:${id}:annulation`,
        })
      }

      const updated = await tx.commande.update({
        where: { id },
        data: { statut: 'annulee' },
        include: {
          lignes: {
            include: {
              article: true,
            },
          },
        },
      })

      await this.recordStatusHistory(tx, {
        commandeId: id,
        ancienStatut: commande.statut,
        nouveauStatut: 'annulee',
        motif: 'annulation',
      })

      return updated
    })
  }

  private async confirmPaidCommande(stripeId: string) {
    const commande = await this.prisma.commande.findFirst({
      where: { stripeId },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })

    if (!commande || commande.statut !== 'paiement_en_attente') {
      return
    }

    return this.prisma.$transaction(async (tx) => {
      const articleIds = commande.lignes.map((ligne) => ligne.articleId)
      const articles = await tx.article.findMany({
        where: {
          id: {
            in: articleIds,
          },
        },
      })

      const insufficientStock = commande.lignes
        .map((ligne) => {
          const article = articles.find((item) => item.id === ligne.articleId)

          if (!article) return null

          return {
            articleId: article.id,
            nom: article.nom,
            stock: article.stock,
            requested: ligne.quantite,
            missing: Math.max(0, ligne.quantite - article.stock),
          }
        })
        .filter((item) => item && item.missing > 0)

      if (insufficientStock.length > 0) {
        await tx.commande.update({
          where: { id: commande.id },
          data: { statut: 'paiement_a_verifier' },
        })

        await this.recordStatusHistory(tx, {
          commandeId: commande.id,
          ancienStatut: commande.statut,
          nouveauStatut: 'paiement_a_verifier',
          motif: 'stock_insuffisant_apres_paiement',
        })

        return null
      }

      for (const ligne of commande.lignes) {
        const article = articles.find((item) => item.id === ligne.articleId)!

        await tx.article.update({
          where: { id: article.id },
          data: {
            stock: {
              decrement: ligne.quantite,
            },
          },
        })

        await this.mouvementsStockService.recordArticleMovement(tx, {
          articleId: article.id,
          quantite: -ligne.quantite,
          stockAvant: article.stock,
          stockApres: article.stock - ligne.quantite,
          type: 'commande',
          motif: `Commande payée #${commande.id}`,
          reference: `commande:${commande.id}`,
        })
      }

      const updated = await tx.commande.update({
        where: { id: commande.id },
        data: { statut: 'nouvelle' },
        include: {
          lignes: {
            include: {
              article: true,
            },
          },
        },
      })

      await this.recordStatusHistory(tx, {
        commandeId: commande.id,
        ancienStatut: commande.statut,
        nouveauStatut: 'nouvelle',
        motif: 'paiement_confirme',
      })

      return updated
    })
  }

  private async expirePendingCommande(stripeId: string) {
    const commandes = await this.prisma.commande.findMany({
      where: {
        stripeId,
        statut: 'paiement_en_attente',
      },
    })

    await this.prisma.$transaction(async (tx) => {
      for (const commande of commandes) {
        await tx.commande.update({
          where: { id: commande.id },
          data: { statut: 'annulee' },
        })

        await this.recordStatusHistory(tx, {
          commandeId: commande.id,
          ancienStatut: commande.statut,
          nouveauStatut: 'annulee',
          motif: 'checkout_expire',
        })
      }
    })
  }

  private async recordStatusHistory(
    tx: {
      commandeStatutHistorique: {
        create: (args: {
          data: {
            commandeId: number
            ancienStatut?: string | null
            nouveauStatut: string
            motif?: string
            createdByUserId?: string
          }
        }) => Promise<unknown>
      }
    },
    data: {
      commandeId: number
      ancienStatut?: string | null
      nouveauStatut: string
      motif?: string
      createdByUserId?: string
    },
  ) {
    await tx.commandeStatutHistorique.create({
      data,
    })
  }

  private getStripe() {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY')

    if (!secretKey) {
      throw new BadRequestException('STRIPE_SECRET_KEY est manquant')
    }

    if (!this.stripe) {
      this.stripe = new Stripe(secretKey)
    }

    return this.stripe
  }

  private async prepareCommande(data: CreateCommandeDto) {
    const lignesAgregees = this.aggregateLines(data.lignes)
    const articleIds = lignesAgregees.map((ligne) => ligne.articleId)

    const articles = await this.prisma.article.findMany({
      where: {
        id: {
          in: articleIds,
        },
        online: true,
      },
    })

    if (articles.length !== articleIds.length) {
      throw new BadRequestException(
        'Un ou plusieurs articles sont introuvables ou indisponibles',
      )
    }

    const insufficientStock = lignesAgregees
      .map((ligne) => {
        const article = articles.find((item) => item.id === ligne.articleId)

        if (!article) return null

        return {
          articleId: article.id,
          nom: article.nom,
          stock: article.stock,
          requested: ligne.quantite,
          missing: Math.max(0, ligne.quantite - article.stock),
        }
      })
      .filter((item) => item && item.missing > 0)

    if (insufficientStock.length > 0) {
      throw new BadRequestException({
        message: 'Stock insuffisant pour une ou plusieurs lignes',
        insufficientStock,
      })
    }

    const totalTTC = lignesAgregees.reduce((total, ligne) => {
      const article = articles.find((item) => item.id === ligne.articleId)!

      return total + article.prix * ligne.quantite
    }, 0)

    return { lignesAgregees, articles, totalTTC }
  }

  private async confirmPaidCommande(stripeId: string) {
    const commande = await this.prisma.commande.findFirst({
      where: { stripeId },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })

    if (!commande || commande.statut !== 'paiement_en_attente') {
      return
    }

    return this.prisma.$transaction(async (tx) => {
      const articleIds = commande.lignes.map((ligne) => ligne.articleId)
      const articles = await tx.article.findMany({
        where: {
          id: {
            in: articleIds,
          },
        },
      })

      const sellableStockByArticle =
        await this.mouvementsStockService.getSellableArticleStock(articles)

      const insufficientStock = commande.lignes
        .map((ligne) => {
          const article = articles.find((item) => item.id === ligne.articleId)

          if (!article) return null
          const sellableStock = sellableStockByArticle.get(article.id) ?? 0

          return {
            articleId: article.id,
            nom: article.nom,
            stock: article.stock,
            sellableStock,
            requested: ligne.quantite,
            missing: Math.max(0, ligne.quantite - sellableStock),
          }
        })
        .filter((item) => item && item.missing > 0)

      if (insufficientStock.length > 0) {
        await tx.commande.update({
          where: { id: commande.id },
          data: { statut: 'paiement_a_verifier' },
        })

        await this.recordStatusHistory(tx, {
          commandeId: commande.id,
          ancienStatut: commande.statut,
          nouveauStatut: 'paiement_a_verifier',
          motif: 'stock_insuffisant_apres_paiement',
        })

        return null
      }

      for (const ligne of commande.lignes) {
        const article = articles.find((item) => item.id === ligne.articleId)!

        await tx.article.update({
          where: { id: article.id },
          data: {
            stock: {
              decrement: ligne.quantite,
            },
          },
        })

        await this.mouvementsStockService.recordArticleMovement(tx, {
          articleId: article.id,
          quantite: -ligne.quantite,
          stockAvant: article.stock,
          stockApres: article.stock - ligne.quantite,
          type: 'commande',
          motif: `Commande payée #${commande.id}`,
          reference: `commande:${commande.id}`,
        })
      }

      const updated = await tx.commande.update({
        where: { id: commande.id },
        data: { statut: 'nouvelle' },
        include: {
          lignes: {
            include: {
              article: true,
            },
          },
        },
      })

      await this.recordStatusHistory(tx, {
        commandeId: commande.id,
        ancienStatut: commande.statut,
        nouveauStatut: 'nouvelle',
        motif: 'paiement_confirme',
      })

      return updated
    })
  }

  private async expirePendingCommande(stripeId: string) {
    const commandes = await this.prisma.commande.findMany({
      where: {
        stripeId,
        statut: 'paiement_en_attente',
      },
    })

    await this.prisma.$transaction(async (tx) => {
      for (const commande of commandes) {
        await tx.commande.update({
          where: { id: commande.id },
          data: { statut: 'annulee' },
        })

        await this.recordStatusHistory(tx, {
          commandeId: commande.id,
          ancienStatut: commande.statut,
          nouveauStatut: 'annulee',
          motif: 'checkout_expire',
        })
      }
    })
  }

  private async recordStatusHistory(
    tx: {
      commandeStatutHistorique: {
        create: (args: {
          data: {
            commandeId: number
            ancienStatut?: string | null
            nouveauStatut: string
            motif?: string
            createdByUserId?: string
          }
        }) => Promise<unknown>
      }
    },
    data: {
      commandeId: number
      ancienStatut?: string | null
      nouveauStatut: string
      motif?: string
      createdByUserId?: string
    },
  ) {
    await tx.commandeStatutHistorique.create({
      data,
    })
  }

  private getStripe() {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY')

    if (!secretKey) {
      throw new BadRequestException('STRIPE_SECRET_KEY est manquant')
    }

    if (!this.stripe) {
      this.stripe = new Stripe(secretKey)
    }

    return this.stripe
  }

  private async prepareCommande(data: CreateCommandeDto) {
    const lignesAgregees = this.aggregateLines(data.lignes)
    const articleIds = lignesAgregees.map((ligne) => ligne.articleId)

    const articles = await this.prisma.article.findMany({
      where: {
        id: {
          in: articleIds,
        },
        online: true,
      },
    })

    if (articles.length !== articleIds.length) {
      throw new BadRequestException(
        'Un ou plusieurs articles sont introuvables ou indisponibles',
      )
    }

    const sellableStockByArticle =
      await this.mouvementsStockService.getSellableArticleStock(articles)

    const insufficientStock = lignesAgregees
      .map((ligne) => {
        const article = articles.find((item) => item.id === ligne.articleId)

        if (!article) return null
        const sellableStock = sellableStockByArticle.get(article.id) ?? 0

        return {
          articleId: article.id,
          nom: article.nom,
          stock: article.stock,
          sellableStock,
          requested: ligne.quantite,
          missing: Math.max(0, ligne.quantite - sellableStock),
        }
      })
      .filter((item) => item && item.missing > 0)

    if (insufficientStock.length > 0) {
      throw new BadRequestException({
        message: 'Stock insuffisant pour une ou plusieurs lignes',
        insufficientStock,
      })
    }

    const totalTTC = lignesAgregees.reduce((total, ligne) => {
      const article = articles.find((item) => item.id === ligne.articleId)!

      return total + article.prix * ligne.quantite
    }, 0)

    return { lignesAgregees, articles, totalTTC }
  }

  private aggregateLines(lignes: CreateCommandeDto['lignes']) {
    const linesByArticle = new Map<number, number>()

    for (const ligne of lignes) {
      linesByArticle.set(
        ligne.articleId,
        (linesByArticle.get(ligne.articleId) ?? 0) + ligne.quantite,
      )
    }

    return Array.from(linesByArticle.entries()).map(
      ([articleId, quantite]) => ({
        articleId,
        quantite,
      }),
    )
  }
}
