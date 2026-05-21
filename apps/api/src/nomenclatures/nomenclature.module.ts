import { Module } from '@nestjs/common'
import { NomenclatureController } from './nomenclature.controller'
import { NomenclatureService } from './nomenclature.service'

@Module({
  controllers: [NomenclatureController],
  providers: [NomenclatureService],
})
export class NomenclatureModule {}