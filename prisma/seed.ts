import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

// Seed = RESET : on repart d'une base propre à chaque exécution.
// (À remplacer par le CRUD UI une fois le Sprint 1 livré.)
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

function periode(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function main() {
  // Reset (ordre = enfants -> parents à cause des FK).
  await prisma.livrable.deleteMany();
  await prisma.engagement.deleteMany();
  await prisma.contrat.deleteMany();
  await prisma.site.deleteMany();
  await prisma.client.deleteMany();

  // 1) Fenêtres sur Loir — contrat éditorial actif (80 €/mois).
  const fsl = await prisma.client.create({
    data: {
      nom: "Fenêtres sur Loir",
      sites: {
        create: {
          nom: "Fenêtres sur Loir",
          statut: "actif",
          contrats: {
            create: {
              libelle: "Suivi éditorial SEO",
              montantMensuel: 80,
              dateDebut: new Date("2026-06-01"),
              statut: "actif",
              engagements: {
                create: {
                  type: "article_seo",
                  libelle: "Article SEO hebdomadaire",
                  quantiteParMois: 4, // ~1 / semaine
                  recurrence: "hebdomadaire",
                },
              },
            },
          },
        },
      },
    },
    include: { sites: { include: { contrats: { include: { engagements: true } } } } },
  });

  // 2) Boost — contrat SEO (60 €/mois), démarre le 1er juillet (1 mois offert).
  await prisma.client.create({
    data: {
      nom: "Boost",
      sites: {
        create: {
          nom: "Boost",
          statut: "actif",
          notes: "Nom de site à confirmer.",
          contrats: {
            create: {
              libelle: "SEO — pages, maillage interne & local SEO",
              montantMensuel: 60,
              dateDebut: new Date("2026-07-01"),
              statut: "actif",
              note: "1 mois offert (juin 2026). Facturation à partir de juillet 2026.",
              engagements: {
                create: [
                  { type: "page_seo", libelle: "Ajout de page(s) optimisée(s) SEO", quantiteParMois: 1 },
                  { type: "maillage_interne", libelle: "Optimisation du maillage interne", quantiteParMois: 1 },
                  { type: "local_seo", libelle: "Optimisation Local SEO", quantiteParMois: 1 },
                  { type: "suivi_seo", libelle: "Suivi SEO", quantiteParMois: 1 },
                ],
              },
            },
          },
        },
      },
    },
  });

  // 3) Victoria Luz — contrat (45 €/mois), démarre le 1er juillet (1 mois offert).
  await prisma.client.create({
    data: {
      nom: "Victoria Luz",
      sites: {
        create: {
          nom: "Victoria Luz",
          statut: "actif",
          contrats: {
            create: {
              libelle: "Suivi récurrent",
              montantMensuel: 45,
              dateDebut: new Date("2026-07-01"),
              statut: "actif",
              note: "1 mois offert (juin 2026). Facturation à partir de juillet 2026.",
              engagements: {
                create: [
                  {
                    type: "publication_podcast",
                    libelle: "Mise en ligne des podcasts (à chaque sortie)",
                    quantiteParMois: 1,
                    recurrence: "a_la_demande",
                  },
                  { type: "suivi_seo", libelle: "Suivi SEO", quantiteParMois: 1 },
                  {
                    type: "maj_contenu",
                    libelle: "Mise à jour de contenu / photos",
                    quantiteParMois: 1,
                  },
                ],
              },
            },
          },
        },
      },
    },
  });

  // Livrables du mois courant : pour chaque engagement dont le contrat a déjà
  // démarré, on instancie quantiteParMois livrables (logique F4, version seed).
  const now = new Date();
  const per = periode(now);

  const engagements = await prisma.engagement.findMany({
    include: { contrat: true },
  });

  for (const e of engagements) {
    if (e.contrat.statut !== "actif") continue;
    if (e.contrat.dateDebut > now) continue; // pas encore démarré (mois offert)
    for (let i = 0; i < e.quantiteParMois; i++) {
      await prisma.livrable.create({
        data: {
          engagementId: e.id,
          periode: per,
          libelle:
            e.quantiteParMois > 1
              ? `${e.libelle} (${i + 1}/${e.quantiteParMois})`
              : e.libelle,
          statut: "a_faire",
          source: "manuel",
        },
      });
    }
  }

  // Récap.
  const [clients, sites, contrats, livrables] = await Promise.all([
    prisma.client.count(),
    prisma.site.count(),
    prisma.contrat.count(),
    prisma.livrable.count(),
  ]);
  console.log(
    `Seed OK — ${clients} clients, ${sites} sites, ${contrats} contrats, ${livrables} livrables (${per}).`,
  );
  console.log(`Client de contrôle: ${fsl.nom}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
