import { prisma } from "@/lib/db";

// Renvoie l'objectif actif, en créant le défaut (cf. docs/PROJET.md §11.2b)
// au premier appel. Idempotent : ne crée qu'une fois.
export async function ensureObjectif() {
  const existing = await prisma.objectifMRR.findFirst({
    where: { actif: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  return prisma.objectifMRR.create({
    data: {
      montantCible: 3000,
      mrrDepart: 180,
      dateDebut: new Date("2026-07-01"),
      dateCible: new Date("2028-07-01"),
      actif: true,
    },
  });
}

// Avancement, rythme et statut (cf. §11.3).
export function computeObjectif(
  o: { montantCible: number; mrrDepart: number; dateDebut: Date; dateCible: Date },
  current: number,
  now: Date = new Date(),
) {
  const span = Math.max(1, o.montantCible - o.mrrDepart);
  const avancement = Math.max(0, Math.min(1, (current - o.mrrDepart) / span));

  const monthsBetween = (a: Date, b: Date) =>
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());

  const moisRestants = Math.max(1, monthsBetween(now, o.dateCible));
  const moisEcoules = Math.max(1, monthsBetween(o.dateDebut, now));

  const rythmeRequis = Math.max(0, (o.montantCible - current) / moisRestants);
  const rythmeReel = Math.max(0, (current - o.mrrDepart) / moisEcoules);

  const atteint = current >= o.montantCible;
  let statut: "ok" | "warn" | "bad";
  let statutLabel: string;
  if (atteint) {
    statut = "ok";
    statutLabel = "Atteint";
  } else if (rythmeReel >= rythmeRequis) {
    statut = "ok";
    statutLabel = "Dans les temps";
  } else if (rythmeReel >= rythmeRequis * 0.5) {
    statut = "warn";
    statutLabel = "À surveiller";
  } else {
    statut = "bad";
    statutLabel = "En retard";
  }

  return {
    avancement,
    pct: Math.round(avancement * 100),
    moisRestants,
    rythmeRequis,
    rythmeReel,
    atteint,
    statut,
    statutLabel,
  };
}
