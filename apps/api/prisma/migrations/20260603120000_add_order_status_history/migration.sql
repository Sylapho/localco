-- CreateTable
CREATE TABLE "CommandeStatutHistorique" (
    "id" SERIAL NOT NULL,
    "commandeId" INTEGER NOT NULL,
    "ancienStatut" TEXT,
    "nouveauStatut" TEXT NOT NULL,
    "motif" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommandeStatutHistorique_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CommandeStatutHistorique" ADD CONSTRAINT "CommandeStatutHistorique_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;
