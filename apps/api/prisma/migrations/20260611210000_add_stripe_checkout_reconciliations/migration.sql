-- CreateEnum
CREATE TYPE "StripeCheckoutReconciliationOperation" AS ENUM (
    'expire_checkout_session',
    'review_paid_cancelled_checkout',
    'review_checkout_payment_mismatch',
    'review_checkout_attachment_conflict'
);

-- CreateEnum
CREATE TYPE "StripeCheckoutReconciliationStatus" AS ENUM (
    'pending',
    'resolved',
    'failed'
);

-- CreateTable
CREATE TABLE "StripeCheckoutReconciliation" (
    "id" SERIAL NOT NULL,
    "commandeId" INTEGER NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "operation" "StripeCheckoutReconciliationOperation" NOT NULL,
    "status" "StripeCheckoutReconciliationStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastAttemptedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeCheckoutReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StripeCheckoutReconciliation_status_operation_idx"
ON "StripeCheckoutReconciliation"("status", "operation");

-- CreateIndex
CREATE INDEX "StripeCheckoutReconciliation_commandeId_idx"
ON "StripeCheckoutReconciliation"("commandeId");

-- CreateIndex
CREATE INDEX "StripeCheckoutReconciliation_stripeSessionId_idx"
ON "StripeCheckoutReconciliation"("stripeSessionId");

-- Only one active reconciliation for the same Stripe session and operation.
CREATE UNIQUE INDEX "StripeCheckoutReconciliation_active_session_operation_key"
ON "StripeCheckoutReconciliation"("stripeSessionId", "operation")
WHERE "status" <> 'resolved';

-- AddForeignKey
ALTER TABLE "StripeCheckoutReconciliation"
ADD CONSTRAINT "StripeCheckoutReconciliation_commandeId_fkey"
FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;
