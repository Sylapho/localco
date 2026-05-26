import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Pool } from 'pg'

type BetterAuthSession = {
  user: {
    id: string
    role?: unknown
  }
}

type BetterAuthInstance = {
  api: {
    getSession(input: { headers: Headers }): Promise<unknown>
  }
}

@Injectable()
export class BetterAuthGuard implements CanActivate {
  private auth?: BetterAuthInstance
  private readonly databaseUrl: string

  constructor(private readonly config: ConfigService) {
    const databaseUrl = this.config.get<string>('DATABASE_URL')

    if (!databaseUrl) {
      throw new Error('DATABASE_URL est manquante')
    }

    this.databaseUrl = databaseUrl
  }

  private async getAuth(): Promise<BetterAuthInstance> {
    if (this.auth) {
      return this.auth
    }

    const { betterAuth } = await import('better-auth')

    this.auth = betterAuth({
      database: new Pool({
        connectionString: this.databaseUrl,
      }),
      emailAndPassword: {
        enabled: true,
      },
      user: {
        additionalFields: {
          role: {
            type: ['gerant', 'vendeur', 'production', 'stock', 'comptable'],
            required: false,
            defaultValue: 'vendeur',
            input: false,
          },
        },
      },
    })

    return this.auth
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: {
        cookie?: string
      }
      userId?: string
      userRole?: string
    }>()
    const cookie = request.headers.cookie

    if (!cookie) {
      throw new UnauthorizedException('Session manquante')
    }

    try {
      const auth = await this.getAuth()
      const session = (await auth.api.getSession({
        headers: new Headers({ cookie }),
      })) as BetterAuthSession | null

      if (!session) {
        throw new UnauthorizedException('Session invalide')
      }

      request.userId = session.user.id
      request.userRole =
        typeof session.user.role === 'string' ? session.user.role : 'vendeur'

      return true
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err
      }

      throw new UnauthorizedException('Session invalide')
    }
  }
}
