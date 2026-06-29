-- AlterTable
ALTER TABLE "Devis" ADD COLUMN "pdfUrl" TEXT;

-- AlterTable
ALTER TABLE "Livrable" ADD COLUMN "semaine" TEXT;

-- AlterTable
ALTER TABLE "Tache" ADD COLUMN "note" TEXT;
ALTER TABLE "Tache" ADD COLUMN "semaine" TEXT;

-- CreateIndex
CREATE INDEX "Livrable_semaine_idx" ON "Livrable"("semaine");

-- CreateIndex
CREATE INDEX "Tache_semaine_idx" ON "Tache"("semaine");
