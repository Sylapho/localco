-- DropForeignKey
ALTER TABLE "MouvementStock" DROP CONSTRAINT "MouvementStock_articleId_fkey";

-- DropForeignKey
ALTER TABLE "MouvementStock" DROP CONSTRAINT "MouvementStock_mpId_fkey";

-- DropForeignKey
ALTER TABLE "StockLot" DROP CONSTRAINT "StockLot_articleId_fkey";

-- DropForeignKey
ALTER TABLE "StockLot" DROP CONSTRAINT "StockLot_mpId_fkey";

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_mpId_fkey" FOREIGN KEY ("mpId") REFERENCES "MatierePremiere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_mpId_fkey" FOREIGN KEY ("mpId") REFERENCES "MatierePremiere"("id") ON DELETE SET NULL ON UPDATE CASCADE;
