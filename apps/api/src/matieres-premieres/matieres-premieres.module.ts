import { Module } from '@nestjs/common'
import { MatieresPremieresController } from './matieres-premieres.controller'
import { MatieresPremieresService } from './matieres-premieres.service'

@Module({
  controllers: [MatieresPremieresController],
  providers: [MatieresPremieresService],
})
export class MatieresPremieresModule {}