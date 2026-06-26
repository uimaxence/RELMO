import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// Singleton Prisma : évite d'épuiser les connexions en dev (hot reload).
// Prisma 7 (générateur `prisma-client`) passe par un driver adapter.
// DATABASE_URL (.env) est résolu relativement à la racine du projet, aussi bien
// par la CLI Prisma que par le runtime Next — même fichier des deux côtés.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrisma() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
