-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "extractionConfidence" TEXT,
ADD COLUMN     "portfolioSize" INTEGER,
ADD COLUMN     "sourcePartnerId" TEXT;

-- CreateIndex
CREATE INDEX "Prospect_sourcePartnerId_idx" ON "Prospect"("sourcePartnerId");

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_sourcePartnerId_fkey" FOREIGN KEY ("sourcePartnerId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
