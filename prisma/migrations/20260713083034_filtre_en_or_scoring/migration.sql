-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "effectif" INTEGER,
ADD COLUMN     "filtreAcces" INTEGER,
ADD COLUMN     "filtreBesoin" BOOLEAN,
ADD COLUMN     "filtreCroissance" INTEGER,
ADD COLUMN     "filtrePotentiel" INTEGER,
ADD COLUMN     "filtreProbleme" INTEGER,
ADD COLUMN     "filtreTier" TEXT,
ADD COLUMN     "filtreTotal" INTEGER,
ADD COLUMN     "filtreTrace" TEXT,
ADD COLUMN     "signauxCroissance" TEXT;

-- CreateIndex
CREATE INDEX "Prospect_filtreTier_idx" ON "Prospect"("filtreTier");
