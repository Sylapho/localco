import { Module } from '@nestjs/common'
import { EmailsModule } from '../emails/emails.module'
import { MouvementsStockModule } from '../mouvements-stock/mouvements-stock.module'
import { CommandesController } from './commandes.controller'
import { CommandesService } from './commandes.service'

@Module({
  imports: [MouvementsStockModule, EmailsModule],
  controllers: [CommandesController],
  providers: [CommandesService],
})
export class CommandesModule {}
