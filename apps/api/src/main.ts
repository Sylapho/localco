import 'dotenv/config'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { createCheckoutRateLimitMiddleware } from './rate-limit/checkout-rate-limit.middleware'

function getCorsOrigins() {
  const configuredOrigins = process.env.API_CORS_ORIGINS

  if (!configuredOrigins) {
    return ['http://localhost:3000', 'http://localhost:3001']
  }

  return configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true })

  app.use('/api/commandes/checkout', createCheckoutRateLimitMiddleware())

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.enableCors({
    origin: getCorsOrigins(),
    credentials: true,
  })

  app.setGlobalPrefix('api')

  const port = process.env.PORT || 4000
  await app.listen(port)

  console.log(`API démarrée sur http://localhost:${port}`)
}

void bootstrap()
