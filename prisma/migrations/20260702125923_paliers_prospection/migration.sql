-- AlterTable
ALTER TABLE "Contrat" ADD COLUMN     "formule" TEXT;

-- AlterTable
ALTER TABLE "Devis" ADD COLUMN     "formule" TEXT;

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "reponduLe" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Reglage" ADD COLUMN     "palierEssentiel" DOUBLE PRECISION NOT NULL DEFAULT 700,
ADD COLUMN     "palierPro" DOUBLE PRECISION NOT NULL DEFAULT 1200,
ADD COLUMN     "tarifSuivi" DOUBLE PRECISION NOT NULL DEFAULT 90;
