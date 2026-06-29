-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT,
    "telephone" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "source" TEXT,
    "sourceDetail" TEXT,
    "secteur" TEXT,
    "notes" TEXT,
    "portailActif" BOOLEAN NOT NULL DEFAULT false,
    "portailToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "url" TEXT,
    "repoGitUrl" TEXT,
    "hebergeur" TEXT,
    "stack" TEXT,
    "contact" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "dateMiseEnLigne" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contrat" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "montantMensuel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montantCreation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "note" TEXT,
    "motifResiliation" TEXT,
    "devisId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contrat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Engagement" (
    "id" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "quantiteParMois" INTEGER NOT NULL DEFAULT 1,
    "recurrence" TEXT NOT NULL DEFAULT 'mensuelle',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Engagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Livrable" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "semaine" TEXT,
    "libelle" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'a_faire',
    "faitLe" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'manuel',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Livrable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Devis" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "siteId" TEXT,
    "libelle" TEXT NOT NULL,
    "montantCreation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montantMensuelPropose" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "dateEnvoi" TIMESTAMP(3),
    "dateRelance" TIMESTAMP(3),
    "dateDecision" TIMESTAMP(3),
    "note" TEXT,
    "motifPerte" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Devis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "devisId" TEXT,
    "canal" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'sortant',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resume" TEXT NOT NULL,
    "contenu" TEXT,
    "pieceJointeUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectifMRR" (
    "id" TEXT NOT NULL,
    "montantCible" DOUBLE PRECISION NOT NULL DEFAULT 3000,
    "mrrDepart" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateCible" TIMESTAMP(3) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObjectifMRR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MrrSnapshot" (
    "id" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "mrr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "potentiel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nbClients" INTEGER NOT NULL DEFAULT 0,
    "nbContrats" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MrrSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "dossier" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "largeur" INTEGER,
    "hauteur" INTEGER,
    "prisLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Envie" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "prix" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "url" TEXT,
    "categorie" TEXT,
    "note" TEXT,
    "priorite" INTEGER NOT NULL DEFAULT 0,
    "achete" BOOLEAN NOT NULL DEFAULT false,
    "acheteLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Envie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reglage" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "pourcentagePlafond" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reglage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tache" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "semaine" TEXT,
    "libelle" TEXT NOT NULL,
    "note" TEXT,
    "type" TEXT NOT NULL DEFAULT 'autre',
    "refType" TEXT,
    "refId" TEXT,
    "priorite" TEXT NOT NULL DEFAULT 'normale',
    "statut" TEXT NOT NULL DEFAULT 'a_faire',
    "genereAuto" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_portailToken_key" ON "Client"("portailToken");

-- CreateIndex
CREATE INDEX "Site_clientId_idx" ON "Site"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Contrat_devisId_key" ON "Contrat"("devisId");

-- CreateIndex
CREATE INDEX "Contrat_siteId_idx" ON "Contrat"("siteId");

-- CreateIndex
CREATE INDEX "Engagement_contratId_idx" ON "Engagement"("contratId");

-- CreateIndex
CREATE INDEX "Livrable_engagementId_idx" ON "Livrable"("engagementId");

-- CreateIndex
CREATE INDEX "Livrable_periode_idx" ON "Livrable"("periode");

-- CreateIndex
CREATE INDEX "Livrable_semaine_idx" ON "Livrable"("semaine");

-- CreateIndex
CREATE INDEX "Devis_clientId_idx" ON "Devis"("clientId");

-- CreateIndex
CREATE INDEX "Devis_statut_idx" ON "Devis"("statut");

-- CreateIndex
CREATE INDEX "Interaction_clientId_idx" ON "Interaction"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "MrrSnapshot_periode_key" ON "MrrSnapshot"("periode");

-- CreateIndex
CREATE INDEX "Photo_clientId_idx" ON "Photo"("clientId");

-- CreateIndex
CREATE INDEX "Photo_dossier_idx" ON "Photo"("dossier");

-- CreateIndex
CREATE INDEX "Tache_date_idx" ON "Tache"("date");

-- CreateIndex
CREATE INDEX "Tache_semaine_idx" ON "Tache"("semaine");

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "Devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Livrable" ADD CONSTRAINT "Livrable_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devis" ADD CONSTRAINT "Devis_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devis" ADD CONSTRAINT "Devis_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "Devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
