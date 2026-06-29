-- CreateTable
CREATE TABLE "Envie" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "libelle" TEXT NOT NULL,
    "prix" REAL NOT NULL DEFAULT 0,
    "url" TEXT,
    "categorie" TEXT,
    "note" TEXT,
    "priorite" INTEGER NOT NULL DEFAULT 0,
    "achete" BOOLEAN NOT NULL DEFAULT false,
    "acheteLe" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Reglage" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "pourcentagePlafond" REAL NOT NULL DEFAULT 30,
    "updatedAt" DATETIME NOT NULL
);
