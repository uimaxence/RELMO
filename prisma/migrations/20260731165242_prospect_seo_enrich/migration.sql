-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "seoMotCleLocal" TEXT,
ADD COLUMN     "seoNbMotsCles" INTEGER,
ADD COLUMN     "seoPositionLocale" INTEGER,
ADD COLUMN     "seoReleveLe" TIMESTAMP(3),
ADD COLUMN     "seoTrafic" INTEGER;
