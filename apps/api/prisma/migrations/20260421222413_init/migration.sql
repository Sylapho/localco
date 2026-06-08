-- CreateTable
CREATE TABLE "Article" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "prix" DOUBLE PRECISION NOT NULL,
    "tva" DOUBLE PRECISION NOT NULL DEFAULT 0.055,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "online" BOOLEAN NOT NULL DEFAULT true,
    "emoji" TEXT NOT NULL DEFAULT '🥖',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatierePremiere" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "stock" DOUBLE PRECISION NOT NULL,
    "unite" TEXT NOT NULL,
    "coutUnitaire" DOUBLE PRECISION NOT NULL,
    "seuil" DOUBLE PRECISION NOT NULL,
    "conditionnement" TEXT NOT NULL,

    CONSTRAINT "MatierePremiere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nomenclature" (
    "articleId" INTEGER NOT NULL,
    "mpId" INTEGER NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Nomenclature_pkey" PRIMARY KEY ("articleId","mpId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'vendeur',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vente" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalTTC" DOUBLE PRECISION NOT NULL,
    "totalHT" DOUBLE PRECISION NOT NULL,
    "tva" DOUBLE PRECISION NOT NULL,
    "mode" TEXT NOT NULL,
    "remise" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Vente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneVente" (
    "id" SERIAL NOT NULL,
    "venteId" INTEGER NOT NULL,
    "articleId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnit" DOUBLE PRECISION NOT NULL,
    "tva" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "LigneVente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commande" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tel" TEXT,
    "totalTTC" DOUBLE PRECISION NOT NULL,
    "lieu" TEXT NOT NULL,
    "dateRetrait" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'nouvelle',
    "stripeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneCommande" (
    "id" SERIAL NOT NULL,
    "commandeId" INTEGER NOT NULL,
    "articleId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnit" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "LigneCommande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneeCaisse" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalTTC" DOUBLE PRECISION NOT NULL,
    "totalHT" DOUBLE PRECISION NOT NULL,
    "tva" DOUBLE PRECISION NOT NULL,
    "especes" DOUBLE PRECISION NOT NULL,
    "cb" DOUBLE PRECISION NOT NULL,
    "cheques" DOUBLE PRECISION NOT NULL,
    "marge" DOUBLE PRECISION NOT NULL,
    "nbVentes" INTEGER NOT NULL,
    "clotureeA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourneeCaisse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "JourneeCaisse_date_key" ON "JourneeCaisse"("date");

-- AddForeignKey
ALTER TABLE "Nomenclature" ADD CONSTRAINT "Nomenclature_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nomenclature" ADD CONSTRAINT "Nomenclature_mpId_fkey" FOREIGN KEY ("mpId") REFERENCES "MatierePremiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vente" ADD CONSTRAINT "Vente_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneVente" ADD CONSTRAINT "LigneVente_venteId_fkey" FOREIGN KEY ("venteId") REFERENCES "Vente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneVente" ADD CONSTRAINT "LigneVente_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
