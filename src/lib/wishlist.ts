import { prisma } from "@/lib/db";

// Wish-list / gamification (cf. docs/PROJET.md & docs/IA.md). Mécanique « paliers
// de MRR auto » : une envie est ABORDABLE quand son prix ne dépasse pas un
// pourcentage du MRR mensuel. Donc seuil de déblocage = prix / (pourcentage/100).
// Ex. à 30 % : un objet à 45 € se débloque dès que le MRR atteint 150 €/mois.

const REGLAGE_ID = "singleton";

// Renvoie le réglage global, en le créant au premier appel (idempotent).
export async function ensureReglage() {
  const existing = await prisma.reglage.findUnique({ where: { id: REGLAGE_ID } });
  if (existing) return existing;
  return prisma.reglage.create({ data: { id: REGLAGE_ID } });
}

// Seuil de MRR à partir duquel l'objet devient abordable.
export function seuilMrr(prix: number, pourcentage: number): number {
  if (pourcentage <= 0) return Infinity;
  return prix / (pourcentage / 100);
}

export type EnvieStatut = {
  seuil: number;
  debloque: boolean;
  progression: number; // 0..1
  reste: number; // €/mois de MRR manquants (0 si débloqué)
};

export function envieStatut(
  prix: number,
  mrr: number,
  pourcentage: number,
): EnvieStatut {
  const seuil = seuilMrr(prix, pourcentage);
  const debloque = mrr >= seuil;
  const progression = seuil > 0 ? Math.min(1, mrr / seuil) : 1;
  return {
    seuil,
    debloque,
    progression,
    reste: debloque ? 0 : seuil - mrr,
  };
}
