-- One order reservation can be released only once, regardless of whether the
-- release is triggered by a manual cancellation, Stripe, or cleanup.
CREATE TABLE "CommandeReservationRelease" (
    "id" SERIAL NOT NULL,
    "commandeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommandeReservationRelease_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommandeReservationRelease_commandeId_key" UNIQUE ("commandeId"),
    CONSTRAINT "CommandeReservationRelease_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "CommandeReservationRelease" ("commandeId", "createdAt")
SELECT
    substring("reference" from '^commande:([0-9]+):reservation:release$')::integer AS "commandeId",
    MIN("createdAt") AS "createdAt"
FROM "MouvementStock"
WHERE "reference" ~ '^commande:[0-9]+:reservation:release$'
  AND EXISTS (
    SELECT 1
    FROM "Commande"
    WHERE "Commande"."id" = substring("MouvementStock"."reference" from '^commande:([0-9]+):reservation:release$')::integer
  )
GROUP BY substring("reference" from '^commande:([0-9]+):reservation:release$')::integer
ON CONFLICT ("commandeId") DO NOTHING;
