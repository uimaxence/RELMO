-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "portailIntro" TEXT;

-- CreateTable
CREATE TABLE "Brief" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "daExistante" TEXT,
    "daDetail" TEXT,
    "charteExistante" TEXT,
    "charteDetail" TEXT,
    "sitesAimes" TEXT,
    "souhaits" TEXT,
    "aEviter" TEXT,
    "rempliLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortailUpdate" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" TEXT,
    "emailEnvoyeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortailUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brief_clientId_key" ON "Brief"("clientId");

-- CreateIndex
CREATE INDEX "PortailUpdate_clientId_idx" ON "PortailUpdate"("clientId");

-- AddForeignKey
ALTER TABLE "Brief" ADD CONSTRAINT "Brief_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortailUpdate" ADD CONSTRAINT "PortailUpdate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
