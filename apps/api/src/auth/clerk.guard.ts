import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { createClerkClient } from '@clerk/backend'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class ClerkGuard implements CanActivate {
  private clerk

  constructor(private config: ConfigService) {
    this.clerk = createClerkClient({
      secretKey: this.config.get('CLERK_SECRET_KEY'),
    })
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const token = request.headers.authorization?.replace('Bearer ', '')

    if (!token) throw new UnauthorizedException('Token manquant')

    try {
      const payload = await this.clerk.verifyToken(token)
      request.userId = payload.sub
      request.userRole = payload.publicMetadata?.role ?? 'vendeur'
      return true
    } catch {
      throw new UnauthorizedException('Token invalide')
    }
  }
}