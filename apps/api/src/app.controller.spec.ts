import { Test, TestingModule } from '@nestjs/testing'
import { AppController } from './app.controller'
import { AppService } from './app.service'

describe('AppController', () => {
  let appController: AppController

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile()

    appController = app.get(AppController)
  })

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!')
    })
  })

  describe('health', () => {
    it('should return API health status', () => {
      const health = appController.getHealth()

      expect(health).toEqual(
        expect.objectContaining({
          status: 'ok',
          service: 'localco-api',
        }),
      )

      expect(typeof health.timestamp).toBe('string')
      expect(typeof health.uptime).toBe('number')
    })
  })
})