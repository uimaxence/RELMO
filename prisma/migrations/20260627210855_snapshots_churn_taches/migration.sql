-- AlterTable
ALTER TABLE "Contrat" ADD COLUMN "motifResiliation" TEXT;

-- CreateTable
CREATE TABLE "MrrSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periode" TEXT NOT NULL,
    "mrr" REAL NOT NULL DEFAULT 0,
    "potentiel" REAL NOT NULL DEFAULT 0,
    "nbClients" INTEGER NOT NULL DEFAULT 0,
    "nbContrats" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Tache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'autre',
    "refType" TEXT,
    "refId" TEXT,
    "priorite" TEXT NOT NULL DEFAULT 'normale',
    "statut" TEXT NOT NULL DEFAULT 'a_faire',
    "genereAuto" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "MrrSnapshot_periode_key" ON "MrrSnapshot"("periode");

-- CreateIndex
CREATE INDEX "Tache_date_idx" ON "Tache"("date");
