import 'dotenv/config'
import { NestExpressApplication } from '@nestjs/platform-express'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import {
  ARTICLE_IMAGE_UPLOAD_ROOT,
  ensureArticleImageUploadDir,
} from './articles/article-image-upload'
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
  ensureArticleImageUploadDir()

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  })

  configureApp(app)

  app.useStaticAssets(ARTICLE_IMAGE_UPLOAD_ROOT, {
    prefix: '/uploads/',
  })

  app.enableCors({
    origin: getCorsOrigins(),
    credentials: true,
  })

  const port = process.env.PORT || 4000
  await app.listen(port)

  console.log(`API démarrée sur http://localhost:${port}`)
}

void bootstrap()
