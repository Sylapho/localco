import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { configureApp } from './bootstrap/configure-app'

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

  configureApp(app)

  app.enableCors({
    origin: getCorsOrigins(),
    credentials: true,
  })

  const port = process.env.PORT || 4000
  await app.listen(port)

  console.log(`API démarrée sur http://localhost:${port}`)
}

void bootstrap()
