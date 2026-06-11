import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { ArticlesModule } from './articles/articles.module'
import { MatieresPremieresModule } from './matieres-premieres/matieres-premieres.module'
import { NomenclatureModule } from './nomenclatures/nomenclature.module'
import { VentesModule } from './ventes/ventes.module'
import { CaisseModule } from './caisse/caisse.module'
import { AuthModule } from './auth/auth.module'
import { MouvementsStockModule } from './mouvements-stock/mouvements-stock.module'
import { CommandesModule } from './commandes/commandes.module'
import { BoutiqueModule } from './boutique/boutique.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    PrismaModule,
    ArticlesModule,
    MatieresPremieresModule,
    NomenclatureModule,
    VentesModule,
    CaisseModule,
    MouvementsStockModule,
    CommandesModule,
    BoutiqueModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
