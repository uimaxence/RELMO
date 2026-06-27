-- AlterTable
ALTER TABLE "Client" ADD COLUMN "secteur" TEXT;
ALTER TABLE "Client" ADD COLUMN "source" TEXT;
ALTER TABLE "Client" ADD COLUMN "sourceDetail" TEXT;

-- AlterTable
ALTER TABLE "Devis" ADD COLUMN "motifPerte" TEXT;
