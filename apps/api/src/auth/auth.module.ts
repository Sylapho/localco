import { Global, Module } from '@nestjs/common'
import { BetterAuthGuard } from './better-auth.guard'
import { RolesGuard } from './roles.guard'

@Global()
@Module({
  providers: [BetterAuthGuard, RolesGuard],
  exports: [BetterAuthGuard, RolesGuard],
})
export class AuthModule {}
