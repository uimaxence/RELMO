-- CreateTable
CREATE TABLE "EcritureCompta" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "libelle" TEXT NOT NULL,
    "compte" TEXT NOT NULL,
    "libelleCompte" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sens" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'indy',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcritureCompta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EcritureCompta_hash_key" ON "EcritureCompta"("hash");

-- CreateIndex
CREATE INDEX "EcritureCompta_periode_idx" ON "EcritureCompta"("periode");

-- CreateIndex
CREATE INDEX "EcritureCompta_type_idx" ON "EcritureCompta"("type");

-- CreateIndex
CREATE INDEX "EcritureCompta_date_idx" ON "EcritureCompta"("date");
