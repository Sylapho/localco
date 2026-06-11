import { INestApplication, ValidationPipe } from '@nestjs/common'
import { createCheckoutRateLimitMiddleware } from '../rate-limit/checkout-rate-limit.middleware'

export function configureApp(app: INestApplication) {
  app.use('/api/commandes/checkout', createCheckoutRateLimitMiddleware())

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.setGlobalPrefix('api')
}
