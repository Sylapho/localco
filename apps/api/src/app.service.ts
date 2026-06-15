import { Injectable } from '@nestjs/common'

export type HealthStatus = {
  status: 'ok'
  service: string
  timestamp: string
  uptime: number
}

@Injectable()
export class AppService {
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
}