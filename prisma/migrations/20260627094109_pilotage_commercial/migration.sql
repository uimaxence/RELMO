-- CreateTable
CREATE TABLE "Devis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "siteId" TEXT,
    "libelle" TEXT NOT NULL,
    "montantCreation" REAL NOT NULL DEFAULT 0,
    "montantMensuelPropose" REAL NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "dateEnvoi" DATETIME,
    "dateRelance" DATETIME,
    "dateDecision" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Devis_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Devis_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "devisId" TEXT,
    "canal" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'sortant',
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resume" TEXT NOT NULL,
    "contenu" TEXT,
    "pieceJointeUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Interaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Interaction_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "Devis" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ObjectifMRR" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "montantCible" REAL NOT NULL DEFAULT 3000,
    "mrrDepart" REAL NOT NULL DEFAULT 0,
    "dateDebut" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateCible" DATETIME NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "email" TEXT,
    "telephone" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Client" ("createdAt", "email", "id", "nom", "notes", "telephone", "updatedAt") SELECT "createdAt", "email", "id", "nom", "notes", "telephone", "updatedAt" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE TABLE "new_Contrat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "montantMensuel" REAL NOT NULL DEFAULT 0,
    "montantCreation" REAL NOT NULL DEFAULT 0,
    "dateDebut" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" DATETIME,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "note" TEXT,
    "devisId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contrat_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Contrat_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "Devis" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Contrat" ("createdAt", "dateDebut", "dateFin", "id", "libelle", "montantMensuel", "note", "siteId", "statut", "updatedAt") SELECT "createdAt", "dateDebut", "dateFin", "id", "libelle", "montantMensuel", "note", "siteId", "statut", "updatedAt" FROM "Contrat";
DROP TABLE "Contrat";
ALTER TABLE "new_Contrat" RENAME TO "Contrat";
CREATE UNIQUE INDEX "Contrat_devisId_key" ON "Contrat"("devisId");
CREATE INDEX "Contrat_siteId_idx" ON "Contrat"("siteId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Devis_clientId_idx" ON "Devis"("clientId");

-- CreateIndex
CREATE INDEX "Devis_statut_idx" ON "Devis"("statut");

-- CreateIndex
CREATE INDEX "Interaction_clientId_idx" ON "Interaction"("clientId");
