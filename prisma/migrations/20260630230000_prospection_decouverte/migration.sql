-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "site" TEXT,
    "domaine" TEXT,
    "ville" TEXT,
    "activite" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "region" TEXT,
    "secteur" TEXT,
    "placeId" TEXT,
    "statutAudit" TEXT NOT NULL DEFAULT 'a_auditer',
    "score" INTEGER,
    "design" TEXT,
    "anciennete" TEXT,
    "pointsFaibles" TEXT,
    "emailsTous" TEXT,
    "siret" TEXT,
    "dirigeant" TEXT,
    "linkedin" TEXT,
    "accrocheEmail" TEXT,
    "accrocheLinkedin" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'nouveau',
    "clientId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_domaine_key" ON "Prospect"("domaine");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_placeId_key" ON "Prospect"("placeId");

-- CreateIndex
CREATE INDEX "Prospect_secteur_idx" ON "Prospect"("secteur");

-- CreateIndex
CREATE INDEX "Prospect_statut_idx" ON "Prospect"("statut");

-- CreateIndex
CREATE INDEX "Prospect_score_idx" ON "Prospect"("score");
