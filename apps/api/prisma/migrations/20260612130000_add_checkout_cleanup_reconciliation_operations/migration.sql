ALTER TYPE "StripeCheckoutReconciliationOperation"
ADD VALUE IF NOT EXISTS 'review_paid_pending_checkout';

ALTER TYPE "StripeCheckoutReconciliationOperation"
ADD VALUE IF NOT EXISTS 'review_missing_checkout_session';
