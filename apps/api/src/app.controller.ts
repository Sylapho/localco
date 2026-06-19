import { Controller, Get, HttpStatus, Res } from '@nestjs/common'
import type { Response } from 'express'
import { AppService } from './app.service'
import type { HealthStatus, ReadinessStatus } from './app.service'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello()
  }

  @Get('health')
  getHealth(): HealthStatus {
    return this.appService.getHealth()
  }

  @Get('health/ready')
  async getReadiness(
    @Res({ passthrough: true }) response: Response,
  ): Promise<ReadinessStatus> {
    const readiness = await this.appService.getReadiness()

    if (readiness.status === 'not_ready') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE)
    }

    return readiness
  }
}
