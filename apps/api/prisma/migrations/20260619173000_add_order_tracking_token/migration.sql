CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE "Commande"
ADD COLUMN "trackingToken" TEXT;

UPDATE "Commande"
SET "trackingToken" = replace(gen_random_uuid()::text, '-', '')
WHERE "trackingToken" IS NULL;

ALTER TABLE "Commande"
ALTER COLUMN "trackingToken" SET NOT NULL;

CREATE UNIQUE INDEX "Commande_trackingToken_key"
ON "Commande"("trackingToken");
