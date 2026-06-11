import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { App } from 'supertest/types'
import { BetterAuthGuard } from '../../src/auth/better-auth.guard'
import { configureApp } from '../../src/bootstrap/configure-app'
import { AppModule } from '../../src/app.module'
import { EmailsService } from '../../src/emails/emails.service'
import { PrismaService } from '../../src/prisma/prisma.service'
import { StripeCheckoutGateway } from '../../src/commandes/stripe-checkout.gateway'
import { E2eBetterAuthGuard } from './auth'
import { prepareE2eEnvironment } from './database'
import { FakeEmailsService } from './fake-emails.service'
import { FakeStripeCheckoutGateway } from './fake-stripe-checkout.gateway'

export type E2eTestApp = {
  app: INestApplication<App>
  prisma: PrismaService
  emails: FakeEmailsService
  stripe: FakeStripeCheckoutGateway
}

export async function createTestApp(): Promise<E2eTestApp> {
  prepareE2eEnvironment()

  const emails = new FakeEmailsService()
  const stripe = new FakeStripeCheckoutGateway()

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(EmailsService)
    .useValue(emails)
    .overrideProvider(StripeCheckoutGateway)
    .useValue(stripe)
    .overrideGuard(BetterAuthGuard)
    .useClass(E2eBetterAuthGuard)
    .compile()

  const app = moduleFixture.createNestApplication<App>({ rawBody: true })
  configureApp(app)
  await app.init()

  return {
    app,
    prisma: app.get(PrismaService),
    emails,
    stripe,
  }
}
