import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'
import { formatCurrencyFromCents } from '../money'

type OrderConfirmationEmail = {
  id: number
  trackingToken?: string | null
  nom: string
  email: string
  totalTtcCents: number
  lieu: string
  dateRetrait?: Date | string | null
  lignes: {
    quantite: number
    prixUnitCents: number
    article: {
      nom: string
    }
  }[]
}

@Injectable()
export class EmailsService {
  private readonly logger = new Logger(EmailsService.name)
  private resend: Resend | null = null

  constructor(private readonly configService: ConfigService) {}

  async sendOrderConfirmation(order: OrderConfirmationEmail) {
    const resend = this.getResend()
    const from = this.configService.get<string>('RESEND_FROM_EMAIL')

    if (!resend || !from) {
      this.logger.warn(
        `Email confirmation skipped for order #${order.id}: Resend is not configured`,
      )
      return
    }

    try {
      const { error } = await resend.emails.send({
        from,
        to: order.email,
        subject: `Confirmation de votre commande #${order.id}`,
        html: this.renderOrderConfirmationHtml(order),
        text: this.renderOrderConfirmationText(order),
      })

      if (error) {
        this.logger.error(
          `Email confirmation failed for order #${order.id}: ${error.message}`,
        )
      }
    } catch (error) {
      this.logger.error(
        `Email confirmation failed for order #${order.id}`,
        error instanceof Error ? error.stack : undefined,
      )
    }
  }

  private getResend() {
    const apiKey = this.configService.get<string>('RESEND_API_KEY')

    if (!apiKey) {
      return null
    }

    if (!this.resend) {
      this.resend = new Resend(apiKey)
    }

    return this.resend
  }

  private renderOrderConfirmationHtml(order: OrderConfirmationEmail) {
    const trackingUrl = this.getTrackingUrl(order.trackingToken)
    const rows = order.lignes
      .map(
        (line) => `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
              ${this.escapeHtml(line.article.nom)}
            </td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: center;">
              ${line.quantite}
            </td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">
              ${formatCurrencyFromCents(line.prixUnitCents * line.quantite)}
            </td>
          </tr>
        `,
      )
      .join('')

    return `
      <div style="font-family: Arial, sans-serif; color: #18181b; line-height: 1.5;">
        <h1 style="color: #b5006e;">Merci pour votre commande</h1>
        <p>Bonjour ${this.escapeHtml(order.nom)},</p>
        <p>Votre paiement a bien été confirmé. Nous préparons votre commande #${order.id}.</p>

        <h2 style="font-size: 18px; margin-top: 24px;">Résumé</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th align="left" style="padding: 8px 0;">Article</th>
              <th align="center" style="padding: 8px 0;">Quantité</th>
              <th align="right" style="padding: 8px 0;">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <p style="font-size: 18px; font-weight: 700; text-align: right;">
          Total TTC : ${formatCurrencyFromCents(order.totalTtcCents)}
        </p>

        <h2 style="font-size: 18px; margin-top: 24px;">Retrait</h2>
        <p>
          Lieu : ${this.escapeHtml(order.lieu)}<br />
          Date souhaitée : ${this.formatDate(order.dateRetrait)}
        </p>

        ${this.renderTrackingLinkHtml(trackingUrl)}

        <p style="margin-top: 24px;">À très vite,<br />Les Cocottes de Diane</p>
      </div>
    `
  }

  private renderOrderConfirmationText(order: OrderConfirmationEmail) {
    const trackingUrl = this.getTrackingUrl(order.trackingToken)
    const lines = order.lignes
      .map(
        (line) =>
          `- ${line.article.nom} x${line.quantite} : ${this.formatCurrency(
            line.prixUnitCents * line.quantite,
          )}`,
      )
      .join('\n')

    return [
      `Bonjour ${order.nom},`,
      '',
      `Votre paiement a bien été confirmé. Nous préparons votre commande #${order.id}.`,
      '',
      'Résumé :',
      lines,
      '',
      `Total TTC : ${formatCurrencyFromCents(order.totalTtcCents)}`,
      '',
      'Retrait :',
      `Lieu : ${order.lieu}`,
      `Date souhaitée : ${this.formatDate(order.dateRetrait)}`,
      '',
      ...(trackingUrl
        ? ['Vous pouvez suivre votre commande ici :', trackingUrl, '']
        : []),
      'À très vite,',
      'Les Cocottes de Diane',
    ].join('\n')
  }

  private getTrackingUrl(token?: string | null) {
    if (!token) {
      return null
    }

    const shopUrl =
      this.configService.get<string>('SHOP_PUBLIC_URL') ??
      'http://localhost:3001'

    return `${shopUrl.replace(/\/$/, '')}/suivi?token=${encodeURIComponent(
      token,
    )}`
  }

  private renderTrackingLinkHtml(trackingUrl: string | null) {
    if (!trackingUrl) {
      return ''
    }

    const escapedUrl = this.escapeHtml(trackingUrl)

    return `
        <p style="margin-top: 24px;">
          Vous pouvez suivre votre commande ici :
          <a href="${escapedUrl}" style="color: #b5006e; font-weight: 700;">
            ${escapedUrl}
          </a>
        </p>
    `
  }

  private formatCurrency(value: number) {
    return formatCurrencyFromCents(value)
  }

  private formatDate(value?: Date | string | null) {
    if (!value) {
      return 'Non précisée'
    }

    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeZone: 'Europe/Paris',
    }).format(new Date(value))
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
  }
}
