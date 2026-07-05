-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "atouts" TEXT,
ADD COLUMN     "cible" TEXT NOT NULL DEFAULT 'client',
ADD COLUMN     "flagAQualifier" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "flagConcurrent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "metier" TEXT,
ADD COLUMN     "nbAvis" INTEGER,
ADD COLUMN     "noteGoogle" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Reglage" ADD COLUMN     "modeleRemu" TEXT NOT NULL DEFAULT 'reciprocite';

-- CreateIndex
CREATE INDEX "Prospect_cible_idx" ON "Prospect"("cible");
