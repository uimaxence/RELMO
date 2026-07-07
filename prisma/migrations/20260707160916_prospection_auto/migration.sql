-- AlterTable
ALTER TABLE "Reglage" ADD COLUMN     "prospectionAutoActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prospectionRotation" INTEGER NOT NULL DEFAULT 0;
