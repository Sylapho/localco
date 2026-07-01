import { Module } from '@nestjs/common'
import { EmailsModule } from '../emails/emails.module'
import { MouvementsStockModule } from '../mouvements-stock/mouvements-stock.module'
import { PickupPointsModule } from '../pickup-points/pickup-points.module'
import { CommandePreparationService } from './commande-preparation.service'
import { CommandeProductionNeedsService } from './commande-production-needs.service'
import { CommandePublicSummaryService } from './commande-public-summary.service'
import { CommandeStatusHistoryService } from './commande-status-history.service'
import { CommandeStockReservationService } from './commande-stock-reservation.service'
import { CommandesController } from './commandes.controller'
import { CommandesService } from './commandes.service'
import { StripeCheckoutGateway } from './stripe-checkout.gateway'

@Module({
  imports: [MouvementsStockModule, EmailsModule, PickupPointsModule],
  controllers: [CommandesController],
  providers: [
    CommandesService,
    StripeCheckoutGateway,
    CommandePreparationService,
    CommandeProductionNeedsService,
    CommandePublicSummaryService,
    CommandeStatusHistoryService,
    CommandeStockReservationService,
  ],
})
export class CommandesModule {}
