-- AlterTable
ALTER TABLE "Reglage" ADD COLUMN     "rapportMensuelActif" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "domaine" TEXT,
ADD COLUMN     "seoLangue" TEXT NOT NULL DEFAULT 'fr',
ADD COLUMN     "seoLocation" TEXT;

-- CreateTable
CREATE TABLE "MotCle" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotCle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionReleve" (
    "id" TEXT NOT NULL,
    "motCleId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "position" INTEGER,
    "url" TEXT,
    "volume" INTEGER,
    "releveLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionReleve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteVisibilite" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "nbMotsCles" INTEGER,
    "traficEstime" INTEGER,
    "releveLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteVisibilite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RapportMensuel" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "intro" TEXT,
    "syntheseSeo" TEXT,
    "commentaire" TEXT,
    "actions" TEXT,
    "envoyeLe" TIMESTAMP(3),
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RapportMensuel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MotCle_siteId_idx" ON "MotCle"("siteId");

-- CreateIndex
CREATE INDEX "PositionReleve_motCleId_idx" ON "PositionReleve"("motCleId");

-- CreateIndex
CREATE UNIQUE INDEX "PositionReleve_motCleId_periode_key" ON "PositionReleve"("motCleId", "periode");

-- CreateIndex
CREATE INDEX "SiteVisibilite_siteId_idx" ON "SiteVisibilite"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteVisibilite_siteId_periode_key" ON "SiteVisibilite"("siteId", "periode");

-- CreateIndex
CREATE INDEX "RapportMensuel_clientId_idx" ON "RapportMensuel"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "RapportMensuel_clientId_periode_key" ON "RapportMensuel"("clientId", "periode");

-- AddForeignKey
ALTER TABLE "MotCle" ADD CONSTRAINT "MotCle_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionReleve" ADD CONSTRAINT "PositionReleve_motCleId_fkey" FOREIGN KEY ("motCleId") REFERENCES "MotCle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteVisibilite" ADD CONSTRAINT "SiteVisibilite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapportMensuel" ADD CONSTRAINT "RapportMensuel_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
