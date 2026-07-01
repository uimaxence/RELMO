-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "contacteLe" TIMESTAMP(3),
ADD COLUMN     "nbRelances" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "relanceFaiteLe" TIMESTAMP(3),
ADD COLUMN     "relanceLe" TIMESTAMP(3);
