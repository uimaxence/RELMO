-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "segment" TEXT NOT NULL DEFAULT 'classique';

-- CreateIndex
CREATE INDEX "Prospect_segment_idx" ON "Prospect"("segment");
