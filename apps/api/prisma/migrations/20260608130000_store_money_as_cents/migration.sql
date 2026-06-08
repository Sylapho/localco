ALTER TABLE "Article" RENAME COLUMN "prix" TO "prixCents";
ALTER TABLE "Article" ALTER COLUMN "prixCents" TYPE INTEGER USING ROUND("prixCents" * 100)::integer;

ALTER TABLE "Article" RENAME COLUMN "tva" TO "tvaBps";
ALTER TABLE "Article" ALTER COLUMN "tvaBps" DROP DEFAULT;
ALTER TABLE "Article" ALTER COLUMN "tvaBps" TYPE INTEGER USING ROUND("tvaBps" * 10000)::integer;
ALTER TABLE "Article" ALTER COLUMN "tvaBps" SET DEFAULT 550;

ALTER TABLE "MatierePremiere" RENAME COLUMN "coutUnitaire" TO "coutUnitaireCents";
ALTER TABLE "MatierePremiere" ALTER COLUMN "coutUnitaireCents" TYPE INTEGER USING ROUND("coutUnitaireCents" * 100)::integer;

ALTER TABLE "Vente" RENAME COLUMN "totalTTC" TO "totalTtcCents";
ALTER TABLE "Vente" ALTER COLUMN "totalTtcCents" TYPE INTEGER USING ROUND("totalTtcCents" * 100)::integer;

ALTER TABLE "Vente" RENAME COLUMN "totalHT" TO "totalHtCents";
ALTER TABLE "Vente" ALTER COLUMN "totalHtCents" TYPE INTEGER USING ROUND("totalHtCents" * 100)::integer;

ALTER TABLE "Vente" RENAME COLUMN "tva" TO "tvaCents";
ALTER TABLE "Vente" ALTER COLUMN "tvaCents" TYPE INTEGER USING ROUND("tvaCents" * 100)::integer;

ALTER TABLE "Vente" RENAME COLUMN "remise" TO "remiseCents";
ALTER TABLE "Vente" ALTER COLUMN "remiseCents" DROP DEFAULT;
ALTER TABLE "Vente" ALTER COLUMN "remiseCents" TYPE INTEGER USING ROUND("remiseCents" * 100)::integer;
ALTER TABLE "Vente" ALTER COLUMN "remiseCents" SET DEFAULT 0;

ALTER TABLE "LigneVente" RENAME COLUMN "prixUnit" TO "prixUnitCents";
ALTER TABLE "LigneVente" ALTER COLUMN "prixUnitCents" TYPE INTEGER USING ROUND("prixUnitCents" * 100)::integer;

ALTER TABLE "LigneVente" RENAME COLUMN "tva" TO "tvaBps";
ALTER TABLE "LigneVente" ALTER COLUMN "tvaBps" TYPE INTEGER USING ROUND("tvaBps" * 10000)::integer;

ALTER TABLE "Commande" RENAME COLUMN "totalTTC" TO "totalTtcCents";
ALTER TABLE "Commande" ALTER COLUMN "totalTtcCents" TYPE INTEGER USING ROUND("totalTtcCents" * 100)::integer;

ALTER TABLE "LigneCommande" RENAME COLUMN "prixUnit" TO "prixUnitCents";
ALTER TABLE "LigneCommande" ALTER COLUMN "prixUnitCents" TYPE INTEGER USING ROUND("prixUnitCents" * 100)::integer;

ALTER TABLE "JourneeCaisse" RENAME COLUMN "totalTTC" TO "totalTtcCents";
ALTER TABLE "JourneeCaisse" ALTER COLUMN "totalTtcCents" TYPE INTEGER USING ROUND("totalTtcCents" * 100)::integer;

ALTER TABLE "JourneeCaisse" RENAME COLUMN "totalHT" TO "totalHtCents";
ALTER TABLE "JourneeCaisse" ALTER COLUMN "totalHtCents" TYPE INTEGER USING ROUND("totalHtCents" * 100)::integer;

ALTER TABLE "JourneeCaisse" RENAME COLUMN "tva" TO "tvaCents";
ALTER TABLE "JourneeCaisse" ALTER COLUMN "tvaCents" TYPE INTEGER USING ROUND("tvaCents" * 100)::integer;

ALTER TABLE "JourneeCaisse" RENAME COLUMN "especes" TO "especesCents";
ALTER TABLE "JourneeCaisse" ALTER COLUMN "especesCents" TYPE INTEGER USING ROUND("especesCents" * 100)::integer;

ALTER TABLE "JourneeCaisse" RENAME COLUMN "cb" TO "cbCents";
ALTER TABLE "JourneeCaisse" ALTER COLUMN "cbCents" TYPE INTEGER USING ROUND("cbCents" * 100)::integer;

ALTER TABLE "JourneeCaisse" RENAME COLUMN "cheques" TO "chequesCents";
ALTER TABLE "JourneeCaisse" ALTER COLUMN "chequesCents" TYPE INTEGER USING ROUND("chequesCents" * 100)::integer;

ALTER TABLE "JourneeCaisse" RENAME COLUMN "marge" TO "margeCents";
ALTER TABLE "JourneeCaisse" ALTER COLUMN "margeCents" TYPE INTEGER USING ROUND("margeCents" * 100)::integer;
