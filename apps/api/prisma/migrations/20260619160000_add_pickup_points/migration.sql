CREATE TABLE "PickupPoint" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "allowedWeekdays" INTEGER[] NOT NULL,
    "alternatingWeekAnchorDate" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupPoint_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PickupPoint_allowed_weekdays_check" CHECK (
      array_length("allowedWeekdays", 1) IS NOT NULL
      AND "allowedWeekdays" <@ ARRAY[0, 1, 2, 3, 4, 5, 6]
    )
);

CREATE UNIQUE INDEX "PickupPoint_label_schedule_key"
ON "PickupPoint"("label", "schedule");

CREATE INDEX "PickupPoint_active_idx"
ON "PickupPoint"("active");

INSERT INTO "PickupPoint"
  ("label", "address", "schedule", "allowedWeekdays", "alternatingWeekAnchorDate", "active", "updatedAt")
VALUES
  ('Marché de Gaillon', 'Marché de Gaillon', 'Mardi matin, 8h-12h', ARRAY[2], NULL, true, CURRENT_TIMESTAMP),
  ('Marché du Neubourg', 'Marché du Neubourg', 'Mercredi matin, 8h-12h', ARRAY[3], NULL, true, CURRENT_TIMESTAMP),
  ('Marché de Conches', 'Marché de Conches', 'Jeudi matin, 8h-12h', ARRAY[4], NULL, true, CURRENT_TIMESTAMP),
  ('À la ferme', 'À la ferme', 'Vendredi après-midi, 16h-18h', ARRAY[5], NULL, true, CURRENT_TIMESTAMP),
  ('À la ferme', 'À la ferme', 'Samedi matin, 8h-12h', ARRAY[6], NULL, true, CURRENT_TIMESTAMP),
  ('AMAP d''Houlbec-Cocherel', 'AMAP d''Houlbec-Cocherel', 'Jeudi, tous les 15 jours', ARRAY[4], '2026-06-25', true, CURRENT_TIMESTAMP),
  ('AMAP Autheuil-Authouillet', 'AMAP Autheuil-Authouillet', 'Jeudi, tous les 15 jours', ARRAY[4], '2026-06-18', true, CURRENT_TIMESTAMP)
ON CONFLICT ("label", "schedule") DO NOTHING;
