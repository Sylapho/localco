CREATE TYPE "ArticleCategory" AS ENUM (
    'JARS',
    'CUTS',
    'PREPARATIONS',
    'SKEWERS',
    'EGGS',
    'PACKS',
    'OTHER'
);

ALTER TABLE "Article"
ADD COLUMN "category" "ArticleCategory" NOT NULL DEFAULT 'OTHER';

CREATE INDEX "Article_category_idx" ON "Article"("category");
