import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from './prisma/prisma.service'

export type HealthStatus = {
  status: 'ok'
  service: string
  timestamp: string
  uptime: number
}

export type ReadinessStatus = {
  status: 'ready' | 'not_ready'
  service: string
  timestamp: string
  checks: {
    database: {
      status: 'up' | 'down'
    }
    stripe: {
      configured: boolean
    }
    resend: {
      configured: boolean
    }
  }
}

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  getHello(): string {
    return 'Hello World!'
  }

  getHealth(): HealthStatus {
    return {
      status: 'ok',
      service: 'localco-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }
  }

  async getReadiness(): Promise<ReadinessStatus> {
    const databaseConfigured = this.isConfigured('DATABASE_URL')
    const databaseAvailable =
      databaseConfigured && (await this.prisma.isDatabaseAvailable())
    const stripeConfigured = this.isConfigured('STRIPE_SECRET_KEY')
    const resendConfigured = this.isConfigured('RESEND_API_KEY')
    const ready = databaseAvailable && stripeConfigured && resendConfigured

    return {
      status: ready ? 'ready' : 'not_ready',
      service: 'localco-api',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: databaseAvailable ? 'up' : 'down',
        },
        stripe: {
          configured: stripeConfigured,
        },
        resend: {
          configured: resendConfigured,
        },
      },
    }
  }

  private isConfigured(name: string) {
    return Boolean(this.configService.get<string>(name)?.trim())
  }
}
