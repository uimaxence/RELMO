-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "dernierMessageId" TEXT,
ADD COLUMN     "optOutLe" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Reglage" ADD COLUMN     "relanceAutoActive" BOOLEAN NOT NULL DEFAULT false;
