import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module'
import { CommandesService } from '../commandes/commandes.service'

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  })

  try {
    const commandesService = app.get(CommandesService)
    const result = await commandesService.cleanupAbandonedCommandes()

    console.log(
      `Cleanup completed: ${result.scanned} scanned, ${result.cancelled} cancelled, ${result.skipped} skipped, ${result.failed} failed`,
    )

    if (result.failed > 0) {
      process.exitCode = 1
    }
  } catch (error) {
    console.error('Cleanup failed')
    if (error instanceof Error) {
      console.error(error.message)
    }
    process.exitCode = 1
  } finally {
    await app.close()
  }
}

void run()
