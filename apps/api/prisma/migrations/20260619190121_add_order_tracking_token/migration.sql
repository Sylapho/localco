-- AlterTable
ALTER TABLE "StripeWebhookEvent" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "StripeCheckoutReconciliationAttempt_reconciliationId_startedAt_" RENAME TO "StripeCheckoutReconciliationAttempt_reconciliationId_starte_idx";
