import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { ArticlesModule } from './articles/articles.module'
import { MatieresPremieresModule } from './matieres-premieres/matieres-premieres.module'
import { NomenclatureModule } from './nomenclatures/nomenclature.module'
import { VentesModule } from './ventes/ventes.module'
import { CaisseModule } from './caisse/caisse.module'
import { AuthModule } from './auth/auth.module'

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
  ],
})
export class AppModule {}
