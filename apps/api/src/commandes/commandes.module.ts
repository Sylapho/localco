import { Module } from '@nestjs/common'
import { EmailsModule } from '../emails/emails.module'
import { MouvementsStockModule } from '../mouvements-stock/mouvements-stock.module'
import { CommandesController } from './commandes.controller'
import { CommandesService } from './commandes.service'
import { StripeCheckoutGateway } from './stripe-checkout.gateway'

@Module({
  imports: [MouvementsStockModule, EmailsModule],
  controllers: [CommandesController],
  providers: [CommandesService, StripeCheckoutGateway],
})
export class CommandesModule {}
