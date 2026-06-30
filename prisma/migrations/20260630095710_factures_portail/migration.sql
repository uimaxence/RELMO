-- AlterTable
ALTER TABLE "Devis" ADD COLUMN     "accepteLe" TIMESTAMP(3),
ADD COLUMN     "dateVueClient" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Livrable" ADD COLUMN     "visibleClient" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Facture" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "siteId" TEXT,
    "numero" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'emise',
    "dateEmission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateEcheance" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "pathnamePdf" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manuel',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Facture_clientId_idx" ON "Facture"("clientId");

-- AddForeignKey
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
